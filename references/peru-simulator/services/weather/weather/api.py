"""HTTP API: layer catalog, per-time metadata and grids, point queries."""

from __future__ import annotations

import datetime as dt
import math
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Query, Request, Response

from .config import Settings
from .grid import sample_mercator_grid
from .glm import cluster_flashes
from .http import Fetcher
from .lightning import LightningPolicy, LightningService
from .products import PRODUCTS
from .service import UTC, WeatherService, iso
from .store import Store
from .wind import compass_label, ms_to_kmh, wind_direction_from, wind_speed


def build_service(settings: Settings, client: httpx.AsyncClient) -> WeatherService:
    return WeatherService(
        Fetcher(client, retries=settings.retries),
        Store(settings.cache_dir),
        [PRODUCTS[p] for p in settings.products],
        settings.grid(),
        settings.fhours,
        base_url=settings.gfs_base_url,
    )


def build_lightning(settings: Settings, client: httpx.AsyncClient) -> LightningService:
    return LightningService(
        Fetcher(client, retries=settings.retries),
        settings.cache_dir / "glm",
        settings.grid().lonlat_bounds(),
        LightningPolicy(
            window_minutes=settings.glm_window_minutes,
            backfill_minutes=min(settings.glm_backfill_minutes, settings.glm_window_minutes),
            poll_seconds=settings.glm_poll_seconds,
        ),
        base_url=settings.glm_base_url,
    )


def wind_point(bands, svc: WeatherService, lon: float, lat: float) -> dict:
    """Speed in km/h and meteorological direction (degrees the wind comes from) at a point."""
    u = v = None
    if bands is not None:
        u = sample_mercator_grid(bands[0], svc.grid, lon, lat)
        v = sample_mercator_grid(bands[1], svc.grid, lon, lat)
    if u is None or v is None:
        return {"value": None, "units": "km/h", "u": None, "v": None, "speedMs": None, "directionDeg": None, "directionCompass": None}
    speed = float(wind_speed(u, v))
    direction = wind_direction_from(u, v)
    return {
        "value": round(ms_to_kmh(speed), 2),
        "units": "km/h",
        "u": round(u, 3),
        "v": round(v, 3),
        "speedMs": round(speed, 3),
        "directionDeg": round(direction, 1),
        "directionCompass": compass_label(direction),
    }


def create_app(
    settings: Settings | None = None,
    service: WeatherService | None = None,
    lightning: LightningService | None = None,
) -> FastAPI:
    """`service` / `lightning` are injected by tests; otherwise built from `settings`
    (observed lightning only when `settings.lightning` and no service is injected)."""
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        client = None
        svc = service
        if svc is None:
            client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0), follow_redirects=True)
            svc = build_service(settings, client)
        glm = lightning
        if glm is None and service is None and settings.lightning and client is not None:
            glm = build_lightning(settings, client)
        app.state.service = svc
        app.state.lightning = glm
        svc.load_cached()
        if glm:
            glm.load_cached()
        if settings.refresh:
            svc.start()
            if glm:
                glm.start()
        try:
            yield
        finally:
            await svc.stop()
            if glm:
                await glm.stop()
            if client:
                await client.aclose()

    app = FastAPI(title="Peru weather layers", lifespan=lifespan)

    def svc_of(request: Request) -> WeatherService:
        return request.app.state.service

    def state_of(request: Request, layer_id: str):
        state = svc_of(request).states.get(layer_id)
        if state is None:
            raise HTTPException(404, f"unknown layer {layer_id}")
        return state

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True}

    @app.get("/api/layers")
    def layers(request: Request) -> dict:
        svc = svc_of(request)
        entries = [svc.catalog_entry(s) for s in svc.states.values()]
        glm = request.app.state.lightning
        if glm is not None:
            entries.append(glm.catalog_entry())
        return {"generatedAt": iso(svc.clock()), "layers": entries}

    def lightning_of(request: Request) -> LightningService:
        glm = request.app.state.lightning
        if glm is None:
            raise HTTPException(404, "observed lightning is disabled (WEATHER_LIGHTNING=0)")
        return glm

    @app.get("/api/lightning")
    def lightning_flashes(request: Request, minutes: float = Query(60, gt=0, le=24 * 60)) -> dict:
        """Flashes of the last `minutes` (columnar; `age` = seconds before windowEnd, oldest first)."""
        glm = lightning_of(request)
        minutes = min(minutes, glm.policy.window_minutes)
        now = glm.clock()
        f = glm.window(minutes)
        end = now.timestamp()
        return {
            "id": "glm-lightning",
            "kind": "observed",
            "status": glm.status,
            "windowMinutes": minutes,
            "windowStart": iso(now - dt.timedelta(minutes=minutes)),
            "windowEnd": iso(now),
            "obsTime": iso(glm.obs_time),
            "coverageStart": iso(glm.coverage_start()),
            "count": len(f),
            "bounds": glm.bounds,
            "flashes": {
                "lat": [round(float(v), 4) for v in f.lat],
                "lon": [round(float(v), 4) for v in f.lon],
                "age": [round(end - float(v), 2) for v in f.time],
                # Optical energy in femtojoules (1e-15 J).
                "energyFj": [round(float(v) * 1e15, 1) for v in f.energy],
            },
        }

    @app.get("/api/lightning/clusters")
    def lightning_clusters(
        request: Request,
        minutes: float = Query(60, gt=0, le=24 * 60),
        cell_km: float = Query(25, gt=0, le=1000),
    ) -> dict:
        """Grid-binned flash counts (cells of ~cell_km), largest first; `latest` is ISO UTC."""
        glm = lightning_of(request)
        minutes = min(minutes, glm.policy.window_minutes)
        f = glm.window(minutes)
        cells = cluster_flashes(f.lat, f.lon, f.time, cell_km)
        return {
            "windowMinutes": minutes,
            "windowEnd": iso(glm.clock()),
            "cellKm": cell_km,
            "count": len(f),
            "cells": [
                {"lat": round(c["lat"], 4), "lon": round(c["lon"], 4), "count": c["count"],
                 "latest": iso(dt.datetime.fromtimestamp(c["latest"], UTC))}
                for c in cells
            ],
        }

    @app.get("/api/layers/{layer_id}/point")
    def point(
        request: Request,
        layer_id: str,
        lat: float = Query(..., ge=-90, le=90),
        lon: float = Query(..., ge=-180, le=360),
        time: str | None = Query(None, description="time id (YYYYMMDDTHHMMZ) or ISO 8601; default: nearest to now"),
    ) -> dict:
        state = state_of(request, layer_id)
        svc = svc_of(request)
        frame = None
        if time:
            frame = state.frame(time)
            if frame is None:
                try:
                    t = dt.datetime.fromisoformat(time.replace("Z", "+00:00"))
                except ValueError:
                    raise HTTPException(400, f"bad time {time}") from None
                frame = state.nearest_frame(t if t.tzinfo else t.replace(tzinfo=UTC))
        else:
            frame = state.nearest_frame(svc.clock())
        if frame is None:
            raise HTTPException(503, f"{layer_id} has no data yet ({state.status})")
        values = svc.values(layer_id, frame.id)
        qlon = lon if lon <= 180 else lon - 360
        base = {
            "layer": layer_id,
            "lat": lat,
            "lon": lon,
            "time": frame.id,
            "validTime": iso(frame.valid_time),
            "issueTime": iso(state.cycle),
            "forecastHour": frame.forecast_hour,
            "kind": state.spec.kind,
        }
        if state.spec.value_kind == "vector":
            return base | wind_point(values, svc, qlon, lat)

        def sample(grid) -> float | None:
            v = None if grid is None else sample_mercator_grid(grid, svc.grid, qlon, lat)
            return None if v is None or math.isnan(v) else round(v, 3)

        if isinstance(values, list):
            # Multi-band scalar (e.g. precipitation rate + accumulation): value = first band.
            bands = {name: sample(g) for name, g in zip(frame.meta["bands"], values)}
            return base | {"value": next(iter(bands.values())), "units": state.spec.units, "bands": bands}
        return base | {"value": sample(values), "units": state.spec.units}

    def frame_or_404(request: Request, layer_id: str, time_id: str):
        state = state_of(request, layer_id)
        frame = state.frame(time_id)
        if frame is None:
            raise HTTPException(404, f"{layer_id} has no frame {time_id}")
        return state, frame

    @app.get("/api/layers/{layer_id}/{time_id}/meta")
    def meta(request: Request, layer_id: str, time_id: str) -> dict:
        return frame_or_404(request, layer_id, time_id)[1].meta

    @app.get("/api/layers/{layer_id}/{time_id}/grid")
    def grid(request: Request, layer_id: str, time_id: str) -> Response:
        state, frame = frame_or_404(request, layer_id, time_id)
        data = state.grids.get(time_id)
        if data is None:
            raise HTTPException(404, "grid not available")
        etag = f'"{frame.meta["issueTime"]}-{time_id}"'
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers={"ETag": etag})
        return Response(
            data,
            media_type="application/octet-stream",
            headers={"ETag": etag, "Cache-Control": "no-cache", "X-Grid-Width": str(frame.meta["width"]), "X-Grid-Height": str(frame.meta["height"])},
        )

    return app
