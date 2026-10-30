import hashlib
import json
import math
import time
from collections.abc import Callable, Sequence
from pathlib import Path

import rasterio
import requests
import truststore

from .config import (
    CACHE_DIR,
    COPERNICUS_DEM_URL,
    HTTP_RETRIES,
    HTTP_RETRY_BACKOFF_S,
    HTTP_TIMEOUT_S,
    HTTP_TOO_MANY_REQUESTS,
    QUOTA_HOURLY_PAUSE_S,
    QUOTA_MINUTELY_PAUSE_S,
    INGEMMET_IMAGE_SERVER_URL,
    INGEMMET_SAMPLE_BATCH_POINTS,
    USER_AGENT,
)

Point = tuple[float, float]

# geocatmin.ingemmet.gob.pe omits its Sectigo intermediate certificate, which
# certifi cannot complete; the OS trust store can, with verification kept on.
truststore.inject_into_ssl()

session = requests.Session()
session.headers["User-Agent"] = USER_AGENT


# Open-Meteo answers 429 with the exhausted window in `reason`: minutely and
# hourly windows are waited out; the daily one stops the run, and because every
# finished response is cached a rerun the next day resumes where it stopped.
def wait_for_quota(reason: str) -> None:
    if reason.startswith("Daily"):
        raise SystemExit(f"Open-Meteo daily quota exhausted ({reason}); rerun tomorrow to resume from the cache")
    pause_s = QUOTA_HOURLY_PAUSE_S if reason.startswith("Hourly") else QUOTA_MINUTELY_PAUSE_S
    print(f"Open-Meteo quota: {reason} Waiting {pause_s} s", flush=True)
    time.sleep(pause_s)


# Every upstream response is cached on disk by request content so a rerun
# after a failure (or with new scoring code) does not hit the public services
# again; delete output/cache to force fresh data.
def cached_request(method: str, url: str, **kwargs) -> dict:
    cache_key = hashlib.sha256(
        json.dumps([method, url, kwargs], sort_keys=True).encode()
    ).hexdigest()
    cache_file = CACHE_DIR / "http" / f"{cache_key}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())

    attempt = 0
    while True:
        attempt += 1
        try:
            response = session.request(method, url, timeout=HTTP_TIMEOUT_S, **kwargs)
            if response.status_code == HTTP_TOO_MANY_REQUESTS:
                wait_for_quota(response.json().get("reason", ""))
                attempt = 0
                continue
            response.raise_for_status()
            payload = response.json()
            if "error" in payload:
                raise RuntimeError(f"{url} returned {payload['error']}")
            break
        except (requests.RequestException, RuntimeError):
            if attempt == HTTP_RETRIES:
                raise
            time.sleep(HTTP_RETRY_BACKOFF_S * attempt)

    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(payload))
    return payload


def in_batches(
    points: Sequence[Point],
    batch_size: int,
    fetch_batch: Callable[[Sequence[Point]], list],
) -> list:
    values: list = []
    for start in range(0, len(points), batch_size):
        values.extend(fetch_batch(points[start : start + batch_size]))
    return values


def dem_tile_name(lng: float, lat: float) -> str:
    lat_floor, lng_floor = math.floor(lat), math.floor(lng)
    return (
        f"Copernicus_DSM_COG_30_{'N' if lat_floor >= 0 else 'S'}{abs(lat_floor):02d}_00_"
        f"{'E' if lng_floor >= 0 else 'W'}{abs(lng_floor):03d}_00_DEM"
    )


def dem_tile(name: str) -> Path | None:
    tile = CACHE_DIR / "dem" / f"{name}.tif"
    if tile.exists():
        return tile
    response = session.get(f"{COPERNICUS_DEM_URL}/{name}/{name}.tif", timeout=HTTP_TIMEOUT_S)
    # Open-ocean tiles are not published.
    if response.status_code in (403, 404):
        return None
    response.raise_for_status()
    tile.parent.mkdir(parents=True, exist_ok=True)
    tile.write_bytes(response.content)
    return tile


def fetch_elevations_m(points: Sequence[Point]) -> list[float | None]:
    elevations: list[float | None] = [None] * len(points)
    indexes_by_tile: dict[str, list[int]] = {}
    for index, (lng, lat) in enumerate(points):
        indexes_by_tile.setdefault(dem_tile_name(lng, lat), []).append(index)
    for name, indexes in indexes_by_tile.items():
        tile = dem_tile(name)
        if tile is None:
            continue
        with rasterio.open(tile) as dataset:
            for index, (value,) in zip(indexes, dataset.sample([points[index] for index in indexes]), strict=True):
                elevations[index] = None if value == dataset.nodata else float(value)
    return elevations


def fetch_ingemmet_classes(service: str, points: Sequence[Point]) -> list[int | None]:
    def fetch_batch(batch: Sequence[Point]) -> list[int | None]:
        payload = cached_request(
            "POST",
            f"{INGEMMET_IMAGE_SERVER_URL}/{service}/ImageServer/getSamples",
            data={
                "geometry": json.dumps(
                    {
                        "points": [[lng, lat] for lng, lat in batch],
                        "spatialReference": {"wkid": 4326},
                    }
                ),
                "geometryType": "esriGeometryMultipoint",
                "returnFirstValueOnly": "true",
                "f": "json",
            },
        )
        classes: list[int | None] = [None] * len(batch)
        for sample in payload["samples"]:
            value = sample.get("value")
            # NoData pixels (outside Peru, lakes) come back as "NoData" or "".
            if value not in (None, "", "NoData"):
                classes[sample["locationId"]] = int(float(value))
        return classes

    return in_batches(points, INGEMMET_SAMPLE_BATCH_POINTS, fetch_batch)
