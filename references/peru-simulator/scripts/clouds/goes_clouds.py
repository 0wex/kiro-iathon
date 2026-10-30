"""Build the Peru cloud overlay from NOAA GOES-19 (GOES-East) full-disk products.

Pipeline:
  1. Find and download the latest ABI-L2-ACMF (clear sky / cloud mask) file and,
     by default, the ABI-L2-CMIPF band 13 (10.3 um clean IR) file of the same scan.
  2. Extract Cloud_Probabilities (fallback: 4-level ACM) and IR brightness temperature.
  3. Turn clear sky into transparency; colder (higher, thicker) tops become brighter
     and more opaque, low warm cloud greyer and more translucent.
  4. Reproject from the ABI fixed grid to Web Mercator (EPSG:3857) over Peru.
  5. Write public/clouds/latest.png (grey + alpha) and public/clouds/latest.json.

Usage: npm run clouds [-- --no-ir] [-- --width 2048] (see --help).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import h5py
import numpy as np
from PIL import Image

import cloud_style as cs
import goes_projection as gp

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BUCKET = "noaa-goes19"
MASK_PRODUCT = "ABI-L2-ACMF"
IR_PRODUCT = "ABI-L2-CMIPF"
S3_NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"
# Fallback if src/domain/peru.ts cannot be parsed.
DEFAULT_PERU_BOUNDS = (-81.4, -18.4, -68.6, 0.0)
SCAN_START_RE = re.compile(r"_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})(\d)_")


def log(msg: str) -> None:
    print(f"[clouds] {msg}", flush=True)


def parse_peru_bounds(source: str) -> tuple[float, float, float, float]:
    m = re.search(r"PERU_BOUNDS[^{]*\{([^}]*)\}", source)
    if not m:
        raise ValueError("PERU_BOUNDS not found")
    values = dict(re.findall(r"(west|south|east|north)\s*:\s*(-?[\d.]+)", m.group(1)))
    return tuple(float(values[k]) for k in ("west", "south", "east", "north"))  # type: ignore[return-value]


def parse_scan_start(key: str) -> str:
    m = SCAN_START_RE.search(key)
    if not m:
        raise ValueError(f"no scan start in {key}")
    year, doy, hh, mm, ss, tenth = (int(g) for g in m.groups())
    t = dt.datetime(year, 1, 1, hh, mm, ss, tzinfo=dt.timezone.utc) + dt.timedelta(days=doy - 1)
    return t.strftime("%Y-%m-%dT%H:%M:%S") + f".{tenth}Z"


def scan_token(key: str) -> str:
    m = SCAN_START_RE.search(key)
    if not m:
        raise ValueError(f"no scan start in {key}")
    return "".join(m.groups())


# --------------------------------------------------------------------------- S3


def list_keys(bucket: str, prefix: str) -> list[tuple[str, int]]:
    keys: list[tuple[str, int]] = []
    token = None
    while True:
        params = {"list-type": "2", "prefix": prefix}
        if token:
            params["continuation-token"] = token
        url = f"https://{bucket}.s3.amazonaws.com/?{urllib.parse.urlencode(params)}"
        with urllib.request.urlopen(url, timeout=30) as resp:
            root = ET.fromstring(resp.read())
        for c in root.iter(f"{S3_NS}Contents"):
            keys.append((c.findtext(f"{S3_NS}Key", ""), int(c.findtext(f"{S3_NS}Size", "0"))))
        if root.findtext(f"{S3_NS}IsTruncated") != "true":
            return keys
        token = root.findtext(f"{S3_NS}NextContinuationToken")


def hour_prefix(product: str, t: dt.datetime) -> str:
    return f"{product}/{t:%Y}/{t.timetuple().tm_yday:03d}/{t:%H}/"


def recent_mask_keys(bucket: str, hours_back: int, now: dt.datetime) -> list[tuple[str, int]]:
    """ACMF keys of the newest non-empty hour (walking back across day/year boundaries)."""
    for h in range(hours_back + 1):
        t = now - dt.timedelta(hours=h)
        keys = [k for k in list_keys(bucket, hour_prefix(MASK_PRODUCT, t)) if k[0].endswith(".nc")]
        if keys:
            return sorted(keys, key=lambda k: scan_token(k[0]), reverse=True)
    raise SystemExit(f"no {MASK_PRODUCT} files in the last {hours_back} hours of s3://{bucket}")


def matching_ir_key(bucket: str, mask_key: str, band: int) -> tuple[str, int] | None:
    token = scan_token(mask_key)
    t = dt.datetime.strptime(token[:9], "%Y%j%H").replace(tzinfo=dt.timezone.utc)
    for key, size in list_keys(bucket, hour_prefix(IR_PRODUCT, t) + "OR_ABI-L2-CMIPF-"):
        if f"C{band:02d}_" in key and f"_s{token}_" in key:
            return key, size
    return None


def download(bucket: str, key: str, size: int, cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / Path(key).name
    if path.exists() and (size <= 0 or path.stat().st_size == size):
        log(f"cache hit {path.name}")
        return path
    url = f"https://{bucket}.s3.amazonaws.com/{key}"
    tmp = path.with_suffix(".part")
    t0 = time.perf_counter()
    with urllib.request.urlopen(url, timeout=120) as resp, open(tmp, "wb") as out:
        while chunk := resp.read(1 << 20):
            out.write(chunk)
    os.replace(tmp, path)
    log(f"downloaded {path.name} ({path.stat().st_size / 1e6:.1f} MB) in {time.perf_counter() - t0:.1f} s")
    return path


def prune_cache(cache: Path, keep: set[str], max_files: int = 6) -> None:
    files = sorted(cache.glob("*.nc"), key=lambda p: p.stat().st_mtime, reverse=True)
    for p in files[max_files:]:
        if p.name not in keep:
            p.unlink()


# --------------------------------------------------------------------- NetCDF


def read_projection(f: h5py.File) -> gp.GoesProjection:
    a = f["goes_imager_projection"].attrs
    return gp.GoesProjection(
        float(a["perspective_point_height"][0]),
        float(a["semi_major_axis"][0]),
        float(a["semi_minor_axis"][0]),
        float(a["longitude_of_projection_origin"][0]),
    )


def read_axis(f: h5py.File, name: str) -> gp.FixedGridAxis:
    var = f[name]
    raw = var[:2].astype(np.float64)
    scale = float(var.attrs["scale_factor"][0])
    offset = float(var.attrs["add_offset"][0])
    start = raw[0] * scale + offset
    return gp.FixedGridAxis(start, (raw[1] - raw[0]) * scale)


class SourceWindow:
    """Fractional source pixel coordinates of every output pixel plus the slab to read."""

    def __init__(self, f: h5py.File, grid: gp.MercatorGrid):
        self.proj = read_projection(f)
        lon, lat = grid.pixel_centers_lonlat()
        x, y, visible = gp.lonlat_to_scan(self.proj, lon, lat)
        cols = read_axis(f, "x").index_of(x)
        rows = read_axis(f, "y").index_of(y)
        n_rows, n_cols = f["y"].shape[0], f["x"].shape[0]
        self.r0 = max(0, int(np.floor(rows.min())) - 2)
        self.r1 = min(n_rows, int(np.ceil(rows.max())) + 3)
        self.c0 = max(0, int(np.floor(cols.min())) - 2)
        self.c1 = min(n_cols, int(np.ceil(cols.max())) + 3)
        self.cols = np.where(visible, cols - self.c0, -1.0)
        self.rows = np.where(visible, rows - self.r0, -1.0)
        self.lon, self.lat = lon, lat

    def read(self, f: h5py.File, name: str) -> np.ndarray:
        return f[name][self.r0 : self.r1, self.c0 : self.c1]

    def sample(self, slab: np.ndarray) -> np.ndarray:
        return cs.bilinear(slab, self.cols, self.rows)


def mask_opacity(f: h5py.File, win: SourceWindow) -> tuple[np.ndarray, str]:
    """Cloud opacity from the ACMF file on the output grid, and the variable used."""
    dqf = win.read(f, "DQF")
    # DQF: 0 good, 1 bad, 2 space, 6 degraded (kept), 255 fill.
    valid = (dqf != 1) & (dqf != 2) & (dqf != 255)
    if "Cloud_Probabilities" in f:
        var = f["Cloud_Probabilities"]
        raw = win.read(f, "Cloud_Probabilities")
        fill = int(var.attrs["_FillValue"][0])
        valid &= raw != fill
        p = raw.astype(np.float64) * float(var.attrs["scale_factor"][0]) + float(var.attrs["add_offset"][0])
        p = np.where(valid, np.clip(p, 0.0, 1.0), 0.0)
        # Ramp after interpolation so edges blend continuously.
        opacity = cs.probability_opacity(win.sample(p))
        used = "Cloud_Probabilities"
    else:
        levels = win.read(f, "ACM")
        valid &= levels != 255
        opacity = np.nan_to_num(win.sample(np.where(valid, cs.acm_opacity(levels), 0.0)), nan=0.0)
        used = "ACM"
    coverage = np.nan_to_num(win.sample(valid.astype(np.float64)), nan=0.0)
    return opacity * cs.smoothstep(0.5, 1.0, coverage), used


def brightness_temperature(f: h5py.File, win: SourceWindow) -> np.ndarray:
    var = f["CMI"]
    raw = win.read(f, "CMI").view(np.uint16)  # stored as int16 with _Unsigned = true
    bt = raw.astype(np.float64) * float(var.attrs["scale_factor"][0]) + float(var.attrs["add_offset"][0])
    bt[raw > 4095] = cs.BT_WARM + 10.0  # fill / no value -> warm, i.e. no cloud signal
    return win.sample(bt)


# --------------------------------------------------------------------- output


def render(mask: np.ndarray, bt: np.ndarray | None, blur_sigma: float) -> tuple[np.ndarray, np.ndarray]:
    mask = cs.gaussian_blur(mask, blur_sigma)
    if bt is None:
        lum, alpha = cs.compose(mask)
        return lum, alpha
    coldness = cs.gaussian_blur(cs.ir_coldness(bt), blur_sigma * 0.75)
    lum, alpha = cs.compose(mask, coldness)
    # Internal texture: shade the cold-top field like a relief, lit from the north-west.
    lum = lum * cs.relief_shading(cs.gaussian_blur(coldness, 1.0))
    return np.clip(lum, 0.0, 1.0), alpha


def write_outputs(out_dir: Path, name: str, lum: np.ndarray, alpha: np.ndarray, meta: dict) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    la = np.dstack([(lum * 255 + 0.5).astype(np.uint8), (alpha * 255 + 0.5).astype(np.uint8)])
    png = out_dir / f"{name}.png"
    tmp_png = out_dir / f"{name}.png.tmp"
    Image.fromarray(la, mode="LA").save(tmp_png, format="PNG", optimize=True)
    os.replace(tmp_png, png)
    # JSON last: a poller that sees new metadata always finds the matching image.
    tmp_json = out_dir / f"{name}.json.tmp"
    tmp_json.write_text(json.dumps(meta, indent=2) + "\n")
    os.replace(tmp_json, out_dir / f"{name}.json")
    return png


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bucket", default=DEFAULT_BUCKET)
    ap.add_argument("--ir-band", type=int, default=13, help="CMIPF IR band used for brightness (default 13)")
    ap.add_argument("--no-ir", action="store_true", help="mask only: skip the second (~24 MB) IR download")
    ap.add_argument("--width", type=int, default=2048, help="output width in pixels")
    ap.add_argument("--margin", type=float, default=2.0, help="degrees added around the Peru bounds")
    ap.add_argument("--blur", type=float, default=1.4, help="Gaussian softening sigma in output pixels")
    ap.add_argument("--hours-back", type=int, default=3)
    ap.add_argument("--out", type=Path, default=REPO_ROOT / "public" / "clouds")
    ap.add_argument("--name", default="latest", help="output base name (latest -> latest.png + latest.json)")
    ap.add_argument("--cache", type=Path, default=Path(__file__).resolve().parent / ".cache")
    args = ap.parse_args(argv)
    t_start = time.perf_counter()

    try:
        bounds = parse_peru_bounds((REPO_ROOT / "src" / "domain" / "peru.ts").read_text())
    except (OSError, ValueError, KeyError):
        bounds = DEFAULT_PERU_BOUNDS
    m = args.margin
    west, south, east, north = bounds[0] - m, bounds[1] - m, bounds[2] + m, bounds[3] + m
    grid = gp.MercatorGrid.from_lonlat(west, south, east, north, args.width)

    now = dt.datetime.now(dt.timezone.utc)
    candidates = recent_mask_keys(args.bucket, args.hours_back, now)
    mask_key, mask_size = candidates[0]
    ir: tuple[str, int] | None = None
    if not args.no_ir:
        # The IR file of the same scan is usually published first; if the newest mask
        # has no IR partner yet, step back to the newest scan that has both.
        for key, size in candidates[:3]:
            ir = matching_ir_key(args.bucket, key, args.ir_band)
            if ir:
                mask_key, mask_size = key, size
                break
        if not ir:
            log(f"no C{args.ir_band:02d} file for the latest scans; continuing with the mask only")
    log(f"mask {mask_key}")
    if ir:
        log(f"ir   {ir[0]}")

    mask_path = download(args.bucket, mask_key, mask_size, args.cache)
    ir_path = download(args.bucket, ir[0], ir[1], args.cache) if ir else None
    t_dl = time.perf_counter()

    with h5py.File(mask_path, "r") as f:
        win = SourceWindow(f, grid)
        mask, used = mask_opacity(f, win)
        lon0 = win.proj.longitude_of_projection_origin
        window = (win.r0, win.r1, win.c0, win.c1)
    bt = None
    if ir_path:
        with h5py.File(ir_path, "r") as f:
            bt = brightness_temperature(f, SourceWindow(f, grid))
    lum, alpha = render(mask, bt, args.blur)
    t_proc = time.perf_counter()

    coverage = float((alpha > 0.1).mean())
    meta = {
        "version": 1,
        "satellite": "GOES-19",
        "product": MASK_PRODUCT,
        "maskVariable": used,
        "irBand": args.ir_band if ir else None,
        "scanStart": parse_scan_start(mask_key),
        "generatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sourceKeys": {"mask": mask_key, "ir": ir[0] if ir else None},
        "image": f"{args.name}.png",
        "width": grid.width,
        "height": grid.height,
        "lonLatBounds": {"west": west, "south": south, "east": east, "north": north},
        "mercatorBounds": {"minX": grid.min_x, "minY": grid.min_y, "maxX": grid.max_x, "maxY": grid.max_y},
        "alphaCoverage": round(coverage, 4),
        "meanAlpha": round(float(alpha.mean()), 4),
        "projectionLongitude": lon0,
    }
    png = write_outputs(args.out, args.name, lum, alpha, meta)
    prune_cache(args.cache, {mask_path.name, ir_path.name if ir_path else ""})
    log(
        f"source window rows {window[0]}:{window[1]} cols {window[2]}:{window[3]}; mask variable {used}; "
        f"IR {'C%02d' % args.ir_band if ir else 'off'}"
    )
    log(
        f"wrote {png.relative_to(REPO_ROOT) if png.is_relative_to(REPO_ROOT) else png} {grid.width}x{grid.height} "
        f"({png.stat().st_size / 1e6:.2f} MB), alpha>0.1 coverage {coverage * 100:.1f}%, mean alpha {alpha.mean():.3f}"
    )
    log(
        f"timing: list+download {t_dl - t_start:.1f} s, process {t_proc - t_dl:.1f} s, "
        f"total {time.perf_counter() - t_start:.1f} s"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
