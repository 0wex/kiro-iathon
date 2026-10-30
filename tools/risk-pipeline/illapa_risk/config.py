from dataclasses import dataclass
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PIPELINE_ROOT / "output"
CACHE_DIR = OUTPUT_DIR / "cache"
REPOSITORY_ROOT = PIPELINE_ROOT.parent.parent
DATABASE_ENV_FILE = REPOSITORY_ROOT / "packages" / "db" / ".env"

USER_AGENT = "illapa-risk-pipeline/0.1 (+https://illapa.app)"
HTTP_TIMEOUT_S = 60
HTTP_RETRIES = 3
HTTP_RETRY_BACKOFF_S = 5
HTTP_TOO_MANY_REQUESTS = 429
QUOTA_MINUTELY_PAUSE_S = 65
QUOTA_HOURLY_PAUSE_S = 600

GEOFABRIK_PERU_URL = "https://download.geofabrik.de/south-america/peru-latest.osm.pbf"
# Copernicus DEM GLO-90 (the DEM behind Open-Meteo's elevation API) as public
# 1° Cloud-Optimized GeoTIFFs. Sampled locally because Open-Meteo bills every
# coordinate as one call (600/minute, 10k/day), far below the pilot's needs.
COPERNICUS_DEM_URL = "https://copernicus-dem-90m.s3.amazonaws.com"

INGEMMET_IMAGE_SERVER_URL = "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services"
# Classes 1 (muy baja) to 5 (muy alta), from the service legend.
INGEMMET_MASS_MOVEMENT_SERVICE = "SERV_IMG_SUSCEP_MOV_MASA"
# Classes 1 to 4 with no published legend on the image service; assumed to
# grow with susceptibility like the MIL1 map service legend (bajo/medio/alto).
INGEMMET_FLUVIAL_FLOOD_SERVICE = "SERV_IMG_SUSCEP_INUN_FLUVIAL"
INGEMMET_SAMPLE_BATCH_POINTS = 200

# UTM 18S covers the Lima–Huancayo corridor; every metric operation runs in it.
METRIC_CRS = "EPSG:32718"
GEOGRAPHIC_CRS = "EPSG:4326"

SEGMENT_CELL_M = 1_000
# Central differences over this offset approximate terrain (hillside) slope,
# not road grade; Open-Meteo's DEM is ~90 m so smaller offsets are noise.
SLOPE_OFFSET_M = 150
WATER_SEARCH_RADIUS_M = 5_000

ROAD_HIGHWAYS = (
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
)
RIVER_TAG = ("waterway", "river")


@dataclass(frozen=True)
class Area:
    name: str
    west: float
    south: float
    east: float
    north: float


# Pilot: Carretera Central (PE-22) Lima–Huancayo, wide enough to include the
# Canta and Cañete–Yauyos corridors as alternatives.
PILOT_AREA = Area(
    name="lima-huancayo",
    west=-77.20,
    south=-12.90,
    east=-75.00,
    north=-11.00,
)
