"""Train the pooled segment-day risk classifier and gate it against the heuristic.

Run with `uv run --extra train python -m illapa_risk.train` after
`illapa_risk.labels` wrote output/labels.parquet. The model is exported to
packages/business/src/risk/model.generated.ts only when it beats the
heuristic on every held-out route that has events.
"""

import hashlib
import json
from datetime import date, timedelta

import geopandas as gpd
import lightgbm as lgb
import m2cgen
import numpy as np
import osmium
import pandas as pd
import shapely
from shapely.geometry import LineString, MultiLineString
from shapely.ops import substring
from sklearn.metrics import average_precision_score, roc_auc_score

from .build import add_terrain_features, add_water_distance, first_tag
from .config import (
    GEOGRAPHIC_CRS,
    RIVER_TAG,
    Area,
    METRIC_CRS,
    OUTPUT_DIR,
    REPOSITORY_ROOT,
    SEGMENT_CELL_M,
    WATER_SEARCH_RADIUS_M,
)
from .osm_extract import peru_extract, read_lines
from .sources import cached_request

# The routes with the most events train one pooled model; PE-22 had too few
# rain events on its own (7 segment-days in 2026).
TRAINING_ROUTES = ("PE-3N", "PE-5N", "PE-5NA", "PE-22")
PERU_AREA = Area(name="peru", west=-81.4, south=-18.4, east=-68.6, north=0.1)

LABEL_RADIUS_M = 1_000
WINDOW_DAYS = 3
# ERA5's native 0.25° grid: finer cells would only repeat its values while
# multiplying the archive cost (Open-Meteo counts every 14 days of every
# location as one call, with 10k calls a day on the free tier).
ARCHIVE_GRID_DEG = 0.25
ARCHIVE_MODEL = "era5"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
ARCHIVE_BATCH_LOCATIONS = 10
ARCHIVE_BILLING_DAYS = 14
# Rain-triggered events concentrate in the austral wet season, so training
# covers November–April only; that also keeps the archive inside the quota.
WET_SEASON_FIRST_MONTH = 11
WET_SEASON_LAST_MONTH = 4
# ERA5T reaches the archive with a few days of delay.
ARCHIVE_DELAY_DAYS = 6
QUANTILE_COUNT = 101

# Order and imputation mirror modelFeatureVector and the IMPUTED_* constants
# in packages/business/src/risk.
MODEL_FEATURES = [
    "terrain_slope_deg",
    "mass_movement_susceptibility",
    "flood_susceptibility",
    "water_distance_m",
    "historical_event_count",
    "antecedent_rain_mm",
    "forecast_rain_mm",
    "month",
]
IMPUTED_FEATURES = {
    "terrain_slope_deg": 22.5,
    "mass_movement_susceptibility": 3,
    "flood_susceptibility": 2.5,
    "water_distance_m": WATER_SEARCH_RADIUS_M,
}

GENERATED_MODEL_FILE = REPOSITORY_ROOT / "packages" / "business" / "src" / "risk" / "model.generated.ts"
LABELS_FILE = OUTPUT_DIR / "labels.parquet"
TRAINING_SEGMENTS_FILE = OUTPUT_DIR / "training-segments.parquet"
REPORT_FILE = OUTPUT_DIR / "training-report.json"


def route_segments(extract) -> gpd.GeoDataFrame:
    ways = read_lines(
        extract,
        PERU_AREA,
        osmium.filter.KeyFilter("ref"),
        keep=lambda tags: "highway" in tags and first_tag(tags["ref"]) in TRAINING_ROUTES,
        tag_keys=("ref",),
    )
    ways["road_code"] = ways["ref"].map(first_tag)
    ways = ways.to_crs(METRIC_CRS)

    pieces = []
    for road_code, geometry in zip(ways["road_code"], ways.geometry, strict=True):
        lines = geometry.geoms if isinstance(geometry, MultiLineString) else [geometry]
        for line in lines:
            for start in np.arange(0, line.length, SEGMENT_CELL_M):
                piece = substring(line, start, min(start + SEGMENT_CELL_M, line.length))
                if isinstance(piece, LineString) and piece.length > 0:
                    midpoint = piece.interpolate(0.5, normalized=True)
                    cell_x = int(np.floor(midpoint.x / SEGMENT_CELL_M))
                    cell_y = int(np.floor(midpoint.y / SEGMENT_CELL_M))
                    pieces.append(
                        {"id": f"{road_code}:{cell_x}:{cell_y}", "road_code": road_code, "geometry": piece}
                    )

    pieces = gpd.GeoDataFrame(pieces, geometry="geometry", crs=METRIC_CRS)
    segments = pieces.dissolve(by="id", aggfunc="first").reset_index()
    segments["length_m"] = segments.geometry.length
    segments["geometry"] = shapely.line_merge(segments.geometry.to_numpy())
    segments = segments.to_crs(GEOGRAPHIC_CRS)
    segments = add_terrain_features(segments)
    return add_water_distance(segments, read_lines(extract, PERU_AREA, osmium.filter.TagFilter(RIVER_TAG)))


def weather_cell(lat: float, lng: float) -> tuple[float, float]:
    return (
        round(round(lat / ARCHIVE_GRID_DEG) * ARCHIVE_GRID_DEG, 4),
        round(round(lng / ARCHIVE_GRID_DEG) * ARCHIVE_GRID_DEG, 4),
    )


# Wet seasons clipped to [start, end], each padded with the rain window so the
# first day of a season still has its antecedent rain.
def wet_seasons(start: date, end: date) -> list[tuple[date, date]]:
    seasons = []
    for year in range(start.year - 1, end.year + 1):
        season_start = date(year, WET_SEASON_FIRST_MONTH, 1) - timedelta(days=WINDOW_DAYS)
        season_end = date(year + 1, WET_SEASON_LAST_MONTH + 1, 1) - timedelta(days=1)
        clipped = (max(season_start, start), min(season_end, end))
        if clipped[0] < clipped[1]:
            seasons.append(clipped)
    return seasons


def daily_rain(cells: list[tuple[float, float]], start: date, end: date) -> pd.DataFrame:
    frames = []
    for season_start, season_end in wet_seasons(start, end):
        for offset in range(0, len(cells), ARCHIVE_BATCH_LOCATIONS):
            batch = cells[offset : offset + ARCHIVE_BATCH_LOCATIONS]
            payload = cached_request(
                "GET",
                OPEN_METEO_ARCHIVE_URL,
                params={
                    "latitude": ",".join(str(lat) for lat, _ in batch),
                    "longitude": ",".join(str(lng) for _, lng in batch),
                    "start_date": season_start.isoformat(),
                    "end_date": season_end.isoformat(),
                    "daily": "precipitation_sum",
                    "models": ARCHIVE_MODEL,
                    "timezone": "America/Lima",
                },
            )
            locations = payload if isinstance(payload, list) else [payload]
            frames.extend(season_frame(batch, locations))
    return pd.concat(frames, ignore_index=True)


def season_frame(batch: list[tuple[float, float]], locations: list[dict]) -> list[pd.DataFrame]:
    return [
        pd.DataFrame(
            {
                "cell_lat": lat,
                "cell_lng": lng,
                "date": pd.to_datetime(location["daily"]["time"]),
                "rain_mm": location["daily"]["precipitation_sum"],
            }
        )
        for (lat, lng), location in zip(batch, locations, strict=True)
    ]


def segment_events(segments: gpd.GeoDataFrame, labels: pd.DataFrame) -> pd.DataFrame:
    events = gpd.GeoDataFrame(
        labels,
        geometry=gpd.points_from_xy(labels["lng"], labels["lat"]),
        crs=GEOGRAPHIC_CRS,
    ).to_crs(METRIC_CRS)
    matched = gpd.sjoin_nearest(
        events,
        segments[["id", "geometry"]].to_crs(METRIC_CRS),
        max_distance=LABEL_RADIUS_M,
        how="inner",
    )
    return (
        matched.rename(columns={"id": "segment_id"})[["segment_id", "date"]]
        .assign(date=lambda frame: pd.to_datetime(frame["date"]).dt.normalize())
        .drop_duplicates()
    )


# One row per segment and day d: rain observed over the window ending on d,
# rain observed on d + 1 (a perfect-forecast proxy), and whether a validated
# event hit the segment on d + 1. History only counts events before d + 1.
def build_dataset(segments: gpd.GeoDataFrame, events: pd.DataFrame, rain: pd.DataFrame) -> pd.DataFrame:
    rain = rain.sort_values(["cell_lat", "cell_lng", "date"]).reset_index(drop=True)
    by_cell = rain.groupby(["cell_lat", "cell_lng"])
    rain["antecedent_rain_mm"] = by_cell["rain_mm"].transform(lambda series: series.rolling(WINDOW_DAYS).sum())
    rain["forecast_rain_mm"] = by_cell["rain_mm"].shift(-1)
    # Rows are only consecutive inside a wet season: windows that would reach
    # across the dry-season gap are dropped.
    window_start = by_cell["date"].shift(WINDOW_DAYS - 1)
    next_day = by_cell["date"].shift(-1)
    consecutive = (rain["date"] - window_start == pd.Timedelta(days=WINDOW_DAYS - 1)) & (
        next_day - rain["date"] == pd.Timedelta(days=1)
    )
    rain = rain[consecutive].dropna(subset=["antecedent_rain_mm", "forecast_rain_mm"])

    static = segments.drop(columns="geometry").assign(
        cell=[weather_cell(lat, lng) for lat, lng in zip(segments["lat"], segments["lng"], strict=True)]
    )
    static["cell_lat"] = static["cell"].map(lambda cell: cell[0])
    static["cell_lng"] = static["cell"].map(lambda cell: cell[1])
    dataset = static.merge(rain, on=["cell_lat", "cell_lng"])
    dataset["target_date"] = dataset["date"] + pd.Timedelta(days=1)
    dataset["month"] = dataset["target_date"].dt.month

    event_keys = set(zip(events["segment_id"], events["date"], strict=True))
    dataset["label"] = [
        int((segment_id, target) in event_keys)
        for segment_id, target in zip(dataset["id"], dataset["target_date"], strict=True)
    ]
    event_dates = events.groupby("segment_id")["date"].apply(lambda dates: np.sort(dates.to_numpy()))
    dataset["historical_event_count"] = [
        int(np.searchsorted(event_dates[segment_id], np.datetime64(target))) if segment_id in event_dates else 0
        for segment_id, target in zip(dataset["id"], dataset["target_date"], strict=True)
    ]
    return dataset.fillna(IMPUTED_FEATURES)


# Mirror of scoreSegmentRisk in packages/business/src/risk/score.ts without
# official alerts (not available historically); keep both in sync.
def heuristic_score(dataset: pd.DataFrame) -> np.ndarray:
    def unit(values):
        return np.clip(values, 0, 1)

    mass_movement = unit((dataset["mass_movement_susceptibility"] - 1) / 4)
    slope = unit(dataset["terrain_slope_deg"] / 45)
    water_proximity = unit(1 - dataset["water_distance_m"] / 1_000)
    flood_exposure = unit((dataset["flood_susceptibility"] - 1) / 3) * water_proximity
    history = unit(dataset["historical_event_count"] / 5)
    static = 0.4 * mass_movement + 0.2 * slope + 0.25 * flood_exposure + 0.15 * history
    forecast_rain = unit(dataset["forecast_rain_mm"] / 25)
    antecedent_rain = unit(dataset["antecedent_rain_mm"] / 60)
    trigger = 1 - (1 - forecast_rain) * (1 - 0.5 * antecedent_rain)
    return (100 * unit(0.9 * static * (0.2 + 0.8 * trigger))).to_numpy()


def new_model() -> lgb.LGBMClassifier:
    return lgb.LGBMClassifier(
        n_estimators=400,
        learning_rate=0.03,
        num_leaves=15,
        min_child_samples=100,
        subsample=0.8,
        subsample_freq=1,
        colsample_bytree=0.8,
        is_unbalance=True,
        verbose=-1,
    )


def leave_routes_out(dataset: pd.DataFrame) -> tuple[dict, np.ndarray]:
    features = dataset[MODEL_FEATURES]
    out_of_fold = np.full(len(dataset), np.nan)
    routes = {}
    for route in TRAINING_ROUTES:
        held_out = (dataset["road_code"] == route).to_numpy()
        positives = int(dataset.loc[held_out, "label"].sum())
        if held_out.sum() == 0 or positives == 0 or dataset.loc[~held_out, "label"].sum() == 0:
            routes[route] = {"rows": int(held_out.sum()), "positives": positives, "evaluated": False}
            continue
        model = new_model().fit(features[~held_out], dataset.loc[~held_out, "label"])
        out_of_fold[held_out] = model.predict_proba(features[held_out])[:, 1]
        labels = dataset.loc[held_out, "label"]
        heuristic = heuristic_score(dataset[held_out])
        routes[route] = {
            "rows": int(held_out.sum()),
            "positives": positives,
            "evaluated": True,
            "model_average_precision": average_precision_score(labels, out_of_fold[held_out]),
            "heuristic_average_precision": average_precision_score(labels, heuristic),
            "model_roc_auc": roc_auc_score(labels, out_of_fold[held_out]),
            "heuristic_roc_auc": roc_auc_score(labels, heuristic),
        }
    return routes, out_of_fold


def export_model(model: lgb.LGBMClassifier, quantiles: np.ndarray, version: str) -> None:
    javascript = m2cgen.export_to_javascript(model)
    GENERATED_MODEL_FILE.write_text(
        "// @ts-nocheck\n"
        "// Generated by tools/risk-pipeline/illapa_risk/train.py. Do not edit.\n"
        'import type { RiskModel } from "./types";\n\n'
        f"{javascript}\n"
        "export const GENERATED_RISK_MODEL: RiskModel | null = {\n"
        f'\tversion: "{version}",\n'
        f"\tfeatureNames: {json.dumps(MODEL_FEATURES)},\n"
        f"\tscoreQuantiles: {json.dumps([float(value) for value in quantiles])},\n"
        "\tpredictProbability: (features) => score(features)[1],\n"
        "};\n"
    )


def main() -> None:
    if not LABELS_FILE.exists():
        raise SystemExit(f"{LABELS_FILE} is missing: run `python -m illapa_risk.labels` first")
    labels = pd.read_parquet(LABELS_FILE)
    # Route segments cost a full pass over the extract plus DEM and INGEMMET
    # sampling, so they are kept between runs; delete the file to rebuild.
    if TRAINING_SEGMENTS_FILE.exists():
        segments = gpd.read_parquet(TRAINING_SEGMENTS_FILE)
    else:
        segments = route_segments(peru_extract())
        segments.to_parquet(TRAINING_SEGMENTS_FILE)

    start = pd.to_datetime(labels["date"]).min().date() - timedelta(days=WINDOW_DAYS)
    end = date.today() - timedelta(days=ARCHIVE_DELAY_DAYS)
    cells = sorted({weather_cell(lat, lng) for lat, lng in zip(segments["lat"], segments["lng"], strict=True)})
    seasons = wet_seasons(start, end)
    billed_calls = len(cells) * sum(-(-((last - first).days + 1) // ARCHIVE_BILLING_DAYS) for first, last in seasons)
    print(f"{len(segments)} segments, {len(labels)} labels, {len(cells)} rain cells, ~{billed_calls} billed archive calls", flush=True)
    rain = daily_rain(cells, start, end)
    events = segment_events(segments, labels)
    dataset = build_dataset(segments, events, rain)

    routes, out_of_fold = leave_routes_out(dataset)
    evaluated = [metrics for metrics in routes.values() if metrics["evaluated"]]
    beats_heuristic = bool(evaluated) and all(
        metrics["model_average_precision"] > metrics["heuristic_average_precision"]
        and metrics["model_roc_auc"] > metrics["heuristic_roc_auc"]
        for metrics in evaluated
    )
    report = {
        "rows": len(dataset),
        "positives": int(dataset["label"].sum()),
        "period": [start.isoformat(), end.isoformat()],
        "routes": routes,
        "beats_heuristic": beats_heuristic,
    }

    if beats_heuristic:
        model = new_model().fit(dataset[MODEL_FEATURES], dataset["label"])
        scored = out_of_fold[~np.isnan(out_of_fold)]
        quantiles = np.quantile(scored, np.linspace(0, 1, QUANTILE_COUNT))
        digest = hashlib.sha1(json.dumps(report, sort_keys=True, default=str).encode()).hexdigest()[:8]
        report["version"] = f"lgbm-{date.today().isoformat()}-{digest}"
        export_model(model, quantiles, report["version"])

    REPORT_FILE.write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
