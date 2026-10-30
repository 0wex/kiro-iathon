"""Build the road graph, road segments and static segment features.

Run with `uv run python -m illapa_risk.build`; outputs land in output/ and are
loaded into MySQL by `illapa_risk.load`.
"""

import hashlib
import json
import math
import uuid
from datetime import UTC, datetime

import geopandas as gpd
import numpy as np
import osmium
import osmnx as ox
import pandas as pd
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, mapping
from shapely.ops import substring

from .config import (
    CACHE_DIR,
    GEOGRAPHIC_CRS,
    INGEMMET_FLUVIAL_FLOOD_SERVICE,
    INGEMMET_MASS_MOVEMENT_SERVICE,
    METRIC_CRS,
    OUTPUT_DIR,
    PILOT_AREA,
    RIVER_TAG,
    SEGMENT_CELL_M,
    SLOPE_OFFSET_M,
    WATER_SEARCH_RADIUS_M,
    Area,
)
from .osm_extract import peru_extract, read_lines, write_road_network
from .sources import fetch_elevations_m, fetch_ingemmet_classes

COORDINATE_PRECISION_DEG = 1e-6
SUSCEPTIBILITY_SAMPLE_FRACTIONS = (0.25, 0.5, 0.75)
UNNAMED_ROAD_KEY_CHARS = 8

to_geographic = Transformer.from_crs(METRIC_CRS, GEOGRAPHIC_CRS, always_xy=True)


# Simplified OSMnx edges merge several OSM ways, so tags arrive as a list.
def first_tag(value) -> str | None:
    if isinstance(value, list):
        value = value[0] if value else None
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return str(value).split(";")[0].strip() or None


def geojson(geometry) -> str:
    return json.dumps(mapping(shapely.set_precision(geometry, COORDINATE_PRECISION_DEG)))


def build_edges(extract, area: Area) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    road_network = write_road_network(extract, area, CACHE_DIR / f"roads-{area.name}.osm")
    graph = ox.graph_from_xml(road_network, bidirectional=False, simplify=True, retain_all=False)
    graph = ox.add_edge_speeds(graph)
    graph = ox.add_edge_travel_times(graph)
    nodes, edges = ox.graph_to_gdfs(graph)
    edges = edges.reset_index()
    edges["road_code"] = edges["ref"].map(first_tag) if "ref" in edges else None
    edges["road_name"] = edges["name"].map(first_tag) if "name" in edges else None
    edges["highway"] = edges["highway"].map(first_tag)
    return nodes, edges


# Simplified OSMnx edges run tens of km through the Andes without a junction,
# which would make one "segment" span far more than a cell. Edges longer than
# SEGMENT_CELL_M are cut into equal pieces joined by synthetic nodes (negative
# ids never clash with OSM). Pieces are cut along the canonical lower-to-higher
# node direction so both directions of a street share the synthetic nodes.
def split_long_edges(
    nodes: gpd.GeoDataFrame, edges: gpd.GeoDataFrame
) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    synthetic_ids: dict[tuple, int] = {}
    synthetic_points: dict[int, tuple[float, float]] = {}
    rows = []
    for edge, line in zip(edges.to_dict("records"), edges.geometry.to_crs(METRIC_CRS), strict=True):
        pieces_count = math.ceil(edge["length"] / SEGMENT_CELL_M)
        if pieces_count <= 1:
            rows.append({**edge, "geometry": line})
            continue
        forward = edge["u"] <= edge["v"]
        canonical = line if forward else line.reverse()
        cuts = [canonical.length * index / pieces_count for index in range(pieces_count + 1)]
        chain = [min(edge["u"], edge["v"])]
        for index in range(1, pieces_count):
            synthetic_key = (min(edge["u"], edge["v"]), max(edge["u"], edge["v"]), edge["key"], index)
            if synthetic_key not in synthetic_ids:
                synthetic_ids[synthetic_key] = -(len(synthetic_ids) + 1)
                point = canonical.interpolate(cuts[index])
                synthetic_points[synthetic_ids[synthetic_key]] = (point.x, point.y)
            chain.append(synthetic_ids[synthetic_key])
        chain.append(max(edge["u"], edge["v"]))
        pieces = [substring(canonical, cuts[index], cuts[index + 1]) for index in range(pieces_count)]
        if not forward:
            chain = chain[::-1]
            pieces = [piece.reverse() for piece in pieces[::-1]]
        for index, piece in enumerate(pieces):
            rows.append(
                {
                    **edge,
                    "u": chain[index],
                    "v": chain[index + 1],
                    "geometry": piece,
                    "length": edge["length"] / pieces_count,
                    "travel_time": edge["travel_time"] / pieces_count,
                }
            )

    split_edges = gpd.GeoDataFrame(rows, geometry="geometry", crs=METRIC_CRS).to_crs(GEOGRAPHIC_CRS)
    synthetic = gpd.GeoSeries(
        gpd.points_from_xy(
            [x for x, _ in synthetic_points.values()], [y for _, y in synthetic_points.values()]
        ),
        crs=METRIC_CRS,
    ).to_crs(GEOGRAPHIC_CRS)
    synthetic_nodes = pd.DataFrame(
        {"x": synthetic.x.to_numpy(), "y": synthetic.y.to_numpy()}, index=list(synthetic_points)
    )
    return pd.concat([nodes[["x", "y"]], synthetic_nodes]), split_edges


def road_key(road_code: str | None, road_name: str | None, highway: str) -> str:
    if road_code:
        return road_code
    digest = hashlib.sha1((road_name or highway).encode()).hexdigest()
    return f"x{digest[:UNNAMED_ROAD_KEY_CHARS]}"


# A segment is one road (by ref, or by name for unnumbered streets) inside a
# SEGMENT_CELL_M grid cell. Both directions of an edge share a segment.
def assign_segments(edges: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    metric_midpoints = edges.geometry.to_crs(METRIC_CRS).interpolate(0.5, normalized=True)
    cell_x = np.floor(metric_midpoints.x / SEGMENT_CELL_M).astype(int)
    cell_y = np.floor(metric_midpoints.y / SEGMENT_CELL_M).astype(int)
    keys = [
        road_key(code, name, highway)
        for code, name, highway in zip(
            edges["road_code"], edges["road_name"], edges["highway"], strict=True
        )
    ]
    edges["segment_id"] = [
        f"{key}:{x}:{y}" for key, x, y in zip(keys, cell_x, cell_y, strict=True)
    ]
    midpoints = metric_midpoints.to_crs(GEOGRAPHIC_CRS)
    edges["lat"] = midpoints.y
    edges["lng"] = midpoints.x
    return edges


def build_segments(edges: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    undirected = edges.assign(
        undirected_key=[
            (min(u, v), max(u, v), key)
            for u, v, key in zip(edges["u"], edges["v"], edges["key"], strict=True)
        ]
    # The reverse of an edge cut exactly on a cell border can land its midpoint
    # in the neighbouring cell, so dedupe per segment, not globally.
    ).drop_duplicates(["undirected_key", "segment_id"])
    rows = []
    for segment_id, group in undirected.groupby("segment_id"):
        merged = shapely.line_merge(shapely.union_all(group.geometry.to_numpy()))
        if not isinstance(merged, LineString | MultiLineString):
            merged = MultiLineString(
                [line for line in group.geometry if isinstance(line, LineString)]
            )
        rows.append(
            {
                "id": segment_id,
                "road_code": group["road_code"].dropna().iloc[0]
                if group["road_code"].notna().any()
                else None,
                "road_name": group["road_name"].dropna().iloc[0]
                if group["road_name"].notna().any()
                else None,
                "length_m": float(group["length"].sum()),
                "geometry": merged,
            }
        )
    return gpd.GeoDataFrame(rows, geometry="geometry", crs=GEOGRAPHIC_CRS)


def longest_part(geometry):
    if isinstance(geometry, MultiLineString):
        return max(geometry.geoms, key=lambda line: line.length)
    return geometry


def add_terrain_features(segments: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    metric_lines = segments.geometry.to_crs(METRIC_CRS).map(longest_part).set_crs(METRIC_CRS)
    centers = metric_lines.interpolate(0.5, normalized=True)

    offsets = [(0, 0), (SLOPE_OFFSET_M, 0), (-SLOPE_OFFSET_M, 0), (0, SLOPE_OFFSET_M), (0, -SLOPE_OFFSET_M)]
    elevation_points = [
        to_geographic.transform(center.x + dx, center.y + dy)
        for center in centers
        for dx, dy in offsets
    ]
    elevations = np.array(fetch_elevations_m(elevation_points), dtype=float).reshape(-1, len(offsets))
    center_m, east_m, west_m, north_m, south_m = elevations.T
    gradient = np.hypot(
        (east_m - west_m) / (2 * SLOPE_OFFSET_M),
        (north_m - south_m) / (2 * SLOPE_OFFSET_M),
    )
    segments["elevation_m"] = center_m
    segments["terrain_slope_deg"] = np.degrees(np.arctan(gradient))

    sample_points = [
        to_geographic.transform(point.x, point.y)
        for line in metric_lines
        for point in (line.interpolate(fraction, normalized=True) for fraction in SUSCEPTIBILITY_SAMPLE_FRACTIONS)
    ]
    samples_per_segment = len(SUSCEPTIBILITY_SAMPLE_FRACTIONS)
    for column, service in (
        ("mass_movement_susceptibility", INGEMMET_MASS_MOVEMENT_SERVICE),
        ("flood_susceptibility", INGEMMET_FLUVIAL_FLOOD_SERVICE),
    ):
        classes = fetch_ingemmet_classes(service, sample_points)
        # The worst class along the segment drives its exposure.
        segments[column] = [
            max((value for value in classes[start : start + samples_per_segment] if value is not None), default=None)
            for start in range(0, len(classes), samples_per_segment)
        ]
    segments["lat"] = centers.to_crs(GEOGRAPHIC_CRS).y.to_numpy()
    segments["lng"] = centers.to_crs(GEOGRAPHIC_CRS).x.to_numpy()
    return segments


def add_water_distance(segments: gpd.GeoDataFrame, rivers: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    nearest = gpd.sjoin_nearest(
        segments[["id", "geometry"]].to_crs(METRIC_CRS),
        rivers[["geometry"]].to_crs(METRIC_CRS),
        max_distance=WATER_SEARCH_RADIUS_M,
        distance_col="water_distance_m",
        how="left",
    ).drop_duplicates("id")
    return segments.merge(nearest[["id", "water_distance_m"]], on="id", how="left")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    area = PILOT_AREA
    extract = peru_extract()

    nodes, edges = build_edges(extract, area)
    nodes, edges = split_long_edges(nodes, edges)
    edges = assign_segments(edges)
    segments = build_segments(edges)
    segments = add_terrain_features(segments)
    segments = add_water_distance(segments, read_lines(extract, area, osmium.filter.TagFilter(RIVER_TAG)))

    run_id = str(uuid.uuid4())
    built_at = datetime.now(UTC)

    pd.DataFrame(
        {
            "id": segments["id"],
            "road_code": segments["road_code"],
            "road_name": segments["road_name"],
            "geometry": segments.geometry.map(geojson),
            "lat": segments["lat"],
            "lng": segments["lng"],
            "length_m": segments["length_m"],
            "elevation_m": segments["elevation_m"],
            "terrain_slope_deg": segments["terrain_slope_deg"],
            "mass_movement_susceptibility": segments["mass_movement_susceptibility"].astype("Int64"),
            "flood_susceptibility": segments["flood_susceptibility"].astype("Int64"),
            "water_distance_m": segments["water_distance_m"],
        }
    ).to_parquet(OUTPUT_DIR / "segments.parquet")

    pd.DataFrame(
        {
            "id": [f"{u}-{v}-{key}" for u, v, key in zip(edges["u"], edges["v"], edges["key"], strict=True)],
            "from_node_id": edges["u"],
            "to_node_id": edges["v"],
            "segment_id": edges["segment_id"],
            "road_code": edges["road_code"],
            "road_name": edges["road_name"],
            "highway": edges["highway"],
            "length_m": edges["length"],
            "travel_time_s": edges["travel_time"],
            "geometry": edges.geometry.map(geojson),
            "lat": edges["lat"],
            "lng": edges["lng"],
        }
    ).to_parquet(OUTPUT_DIR / "edges.parquet")

    pd.DataFrame({"id": nodes.index, "lat": nodes["y"], "lng": nodes["x"]}).to_parquet(
        OUTPUT_DIR / "nodes.parquet"
    )

    run = {
        "id": run_id,
        "area": area.name,
        "segments": len(segments),
        "nodes": len(nodes),
        "edges": len(edges),
        "built_at": built_at.isoformat(),
        "sources": {
            "osm": f"Geofabrik {extract.name}",
            "elevation": "Copernicus DEM GLO-90 (AWS open data)",
            "mass_movement": f"INGEMMET {INGEMMET_MASS_MOVEMENT_SERVICE}",
            "fluvial_flood": f"INGEMMET {INGEMMET_FLUVIAL_FLOOD_SERVICE}",
            "water": "OSM waterway=river",
        },
    }
    (OUTPUT_DIR / "run.json").write_text(json.dumps(run, indent=2))
    print(json.dumps(run, indent=2))


if __name__ == "__main__":
    main()
