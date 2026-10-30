"""Fetch validated historical rain-triggered events as training labels.

Run with `uv run python -m illapa_risk.labels`; writes output/labels.parquet
for `illapa_risk.train`.

Source: INDECI COEN emergencies (the same API apps/scraper polls with a two
day window), which accepts a long `daysAgo` and returns every registered
emergency since 2023-01-09 with a point and an occurrence timestamp.
"""

from collections import Counter
from datetime import date

import pandas as pd

from .config import OUTPUT_DIR
from .sources import cached_request

COEN_EMERGENCIES_URL = "https://coen.indeci.gob.pe/api/v2/mer/emergencies/geojson-last-emergencies"
COEN_FIRST_DAY = date(2023, 1, 9)
SOURCE = "indeci_coen_emergencies"

# Rain-triggered hazards that physically affect roads. "3200 LLUVIAS INTENSAS"
# is left out: it reports the rain itself at district level, which would leak
# the precipitation feature into the label.
LABEL_HAZARD_CODES = {
    "2100": "landslide",  # huaico (flujo de detritos)
    "2210": "landslide",  # derrumbe
    "2400": "landslide",  # deslizamiento
    "3110": "flood",  # inundación fluvial
}
# Many emergencies reuse one point (a district or province centroid). Those
# cannot be tied to a road segment, so locations shared by this many events
# or more are dropped.
CENTROID_REUSE_MIN_EVENTS = 5
COORDINATE_KEY_DECIMALS = 5


def main() -> None:
    payload = cached_request(
        "GET",
        COEN_EMERGENCIES_URL,
        params={"daysAgo": (date.today() - COEN_FIRST_DAY).days, "fetchedOn": date.today().isoformat()},
    )
    rows = []
    for feature in payload["features"]:
        properties = feature["properties"]
        # "Código del tipo de peligro" is an internal id; the hazard code
        # prefixes the name, e.g. "2100 HUAICO (FLUJO DE DETRITOS)".
        hazard_code = str(properties.get("Tipo de peligro") or "")[:4]
        geometry = feature.get("geometry") or {}
        occurred_at = properties.get("Fecha de ocurrencia")
        if (
            hazard_code not in LABEL_HAZARD_CODES
            or geometry.get("type") != "Point"
            or len(geometry.get("coordinates") or []) < 2
            # Some emergencies carry a Point with [null, null] coordinates.
            or any(value is None for value in geometry["coordinates"][:2])
            or not occurred_at
        ):
            continue
        lng, lat = geometry["coordinates"][:2]
        rows.append(
            {
                "event_id": str(properties["id"]),
                # COEN timestamps are UTC; the daily rain windows use the Lima
                # calendar day.
                "date": pd.Timestamp(occurred_at).tz_convert("America/Lima").tz_localize(None).normalize(),
                "lat": lat,
                "lng": lng,
                "category": LABEL_HAZARD_CODES[hazard_code],
                "source": SOURCE,
            }
        )

    labels = pd.DataFrame(rows).drop_duplicates("event_id")
    location_keys = list(
        zip(labels["lat"].round(COORDINATE_KEY_DECIMALS), labels["lng"].round(COORDINATE_KEY_DECIMALS), strict=True)
    )
    reuse = Counter(location_keys)
    labels = labels[[reuse[key] < CENTROID_REUSE_MIN_EVENTS for key in location_keys]]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    labels.to_parquet(OUTPUT_DIR / "labels.parquet")
    print(
        f"{len(labels)} labels ({labels['category'].value_counts().to_dict()}) "
        f"from {labels['date'].min().date()} to {labels['date'].max().date()}; "
        f"{len(rows) - len(labels)} dropped as shared centroids or duplicates"
    )


if __name__ == "__main__":
    main()
