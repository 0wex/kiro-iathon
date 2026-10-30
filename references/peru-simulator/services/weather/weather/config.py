"""Settings from environment variables (all optional)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from .gfs import BUCKET_URL, parse_fhours
from .glm import GLM_BUCKET_URL
from .grid import MercatorGrid

SERVICE_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    cache_dir: Path = SERVICE_DIR / ".cache"
    #: Forecast hours, e.g. "0-48:3".
    fhours: tuple[int, ...] = tuple(parse_fhours("0-48:3"))
    products: tuple[str, ...] = ("gfs-t2m", "gfs-wind10m", "gfs-precip", "gfs-cape")
    grid_width: int = 256
    #: Degrees around PERU_BOUNDS (same as the cloud pipeline default).
    margin: float = 2.0
    retries: int = 3
    refresh: bool = True
    gfs_base_url: str = BUCKET_URL
    #: Observed lightning (GOES-19 GLM): rolling window, cold-start backfill and poll interval.
    lightning: bool = True
    glm_base_url: str = GLM_BUCKET_URL
    glm_window_minutes: int = 60
    glm_backfill_minutes: int = 60
    glm_poll_seconds: int = 60

    def grid(self) -> MercatorGrid:
        return MercatorGrid.peru(self.grid_width, self.margin)

    @staticmethod
    def from_env() -> "Settings":
        env = os.environ
        d = Settings()
        return Settings(
            cache_dir=Path(env.get("WEATHER_CACHE_DIR", d.cache_dir)),
            fhours=tuple(parse_fhours(env["WEATHER_FHOURS"])) if "WEATHER_FHOURS" in env else d.fhours,
            products=tuple(p for p in env.get("WEATHER_PRODUCTS", ",".join(d.products)).split(",") if p),
            grid_width=int(env.get("WEATHER_GRID_WIDTH", d.grid_width)),
            margin=float(env.get("WEATHER_MARGIN", d.margin)),
            retries=int(env.get("WEATHER_RETRIES", d.retries)),
            refresh=env.get("WEATHER_REFRESH", "1") != "0",
            gfs_base_url=env.get("WEATHER_GFS_BASE_URL", d.gfs_base_url),
            lightning=env.get("WEATHER_LIGHTNING", "1") != "0",
            glm_base_url=env.get("WEATHER_GLM_BASE_URL", d.glm_base_url),
            glm_window_minutes=int(env.get("WEATHER_GLM_WINDOW_MIN", d.glm_window_minutes)),
            glm_backfill_minutes=int(env.get("WEATHER_GLM_BACKFILL_MIN", d.glm_backfill_minutes)),
            glm_poll_seconds=int(env.get("WEATHER_GLM_POLL_S", d.glm_poll_seconds)),
        )
