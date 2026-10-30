"""Read OpenStreetMap data from the Geofabrik Peru extract instead of Overpass.

The public Overpass servers throttle or block the ~25 sub-queries the pilot
area needs, so the pipeline downloads one dated .osm.pbf and reads it locally.
"""

from collections.abc import Callable
from pathlib import Path

import geopandas as gpd
import osmium
import requests
from shapely.geometry import LineString

from .config import (
    CACHE_DIR,
    GEOFABRIK_PERU_URL,
    GEOGRAPHIC_CRS,
    HTTP_TIMEOUT_S,
    ROAD_HIGHWAYS,
    USER_AGENT,
    Area,
)

GEOFABRIK_DIR = CACHE_DIR / "geofabrik"
DOWNLOAD_CHUNK_BYTES = 1 << 20


# Geofabrik redirects peru-latest to a dated file name (peru-YYMMDD), which
# becomes the cached file, so a rerun on the same day reuses it and the build
# can record which snapshot it used.
def peru_extract() -> Path:
    GEOFABRIK_DIR.mkdir(parents=True, exist_ok=True)
    response = requests.head(
        GEOFABRIK_PERU_URL, headers={"User-Agent": USER_AGENT}, allow_redirects=True, timeout=HTTP_TIMEOUT_S
    )
    response.raise_for_status()
    extract = GEOFABRIK_DIR / Path(response.url).name
    if extract.exists():
        return extract
    partial = extract.with_suffix(".part")
    with requests.get(response.url, headers={"User-Agent": USER_AGENT}, stream=True, timeout=HTTP_TIMEOUT_S) as download:
        download.raise_for_status()
        with partial.open("wb") as file:
            for chunk in download.iter_content(DOWNLOAD_CHUNK_BYTES):
                file.write(chunk)
    partial.rename(extract)
    return extract


def in_area(location: osmium.osm.Location, area: Area) -> bool:
    return location.valid() and area.west <= location.lon <= area.east and area.south <= location.lat <= area.north


def write_road_network(extract: Path, area: Area, destination: Path) -> Path:
    """Write the road ways touching `area` plus all their nodes as OSM XML for
    `osmnx.graph_from_xml`; ways crossing the border are kept whole."""
    way_ids: set[int] = set()
    node_ids: set[int] = set()
    road_filter = osmium.filter.TagFilter(*(("highway", highway) for highway in ROAD_HIGHWAYS))
    for way in osmium.FileProcessor(extract).with_locations().with_filter(road_filter):
        if way.is_way() and any(in_area(node.location, area) for node in way.nodes):
            way_ids.add(way.id)
            node_ids.update(node.ref for node in way.nodes)

    destination.unlink(missing_ok=True)
    with osmium.SimpleWriter(str(destination)) as writer:
        for entity in osmium.FileProcessor(extract, osmium.osm.NODE | osmium.osm.WAY):
            if (entity.is_node() and entity.id in node_ids) or (entity.is_way() and entity.id in way_ids):
                writer.add(entity)
    return destination


def read_lines(
    extract: Path,
    area: Area,
    entity_filter,
    keep: Callable[[dict[str, str]], bool] = lambda tags: True,
    tag_keys: tuple[str, ...] = (),
) -> gpd.GeoDataFrame:
    """Ways passing `entity_filter` and `keep` with a node in `area`, as lines."""
    rows = []
    for way in osmium.FileProcessor(extract).with_locations().with_filter(entity_filter):
        if not way.is_way():
            continue
        tags = dict(way.tags)
        if not keep(tags) or not any(in_area(node.location, area) for node in way.nodes):
            continue
        coordinates = [(node.location.lon, node.location.lat) for node in way.nodes if node.location.valid()]
        if len(coordinates) >= 2:
            rows.append({"osm_id": way.id, **{key: tags.get(key) for key in tag_keys}, "geometry": LineString(coordinates)})
    return gpd.GeoDataFrame(rows, geometry="geometry", crs=GEOGRAPHIC_CRS)
