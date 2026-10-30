"""Replace the road graph and segment tables with the latest build output.

Run with `uv run python -m illapa_risk.load` after `illapa_risk.build`. It
reads DATABASE_URL from packages/db/.env and only touches this project's
prefixed risk tables.
"""

import json
from datetime import datetime
from urllib.parse import unquote, urlparse

import pandas as pd
import pymysql

from .config import DATABASE_ENV_FILE, OUTPUT_DIR

TABLE_PREFIX = "hack_the_andes_"
INSERT_BATCH_ROWS = 2_000

SEGMENT_COLUMNS = [
    "id",
    "road_code",
    "road_name",
    "geometry",
    "lat",
    "lng",
    "length_m",
    "elevation_m",
    "terrain_slope_deg",
    "mass_movement_susceptibility",
    "flood_susceptibility",
    "water_distance_m",
]
EDGE_COLUMNS = [
    "id",
    "from_node_id",
    "to_node_id",
    "segment_id",
    "road_code",
    "road_name",
    "highway",
    "length_m",
    "travel_time_s",
    "geometry",
    "lat",
    "lng",
]
NODE_COLUMNS = ["id", "lat", "lng"]


def database_url() -> str:
    for line in DATABASE_ENV_FILE.read_text().splitlines():
        key, _, value = line.partition("=")
        if key.strip() == "DATABASE_URL":
            return value.strip().strip("\"'")
    raise RuntimeError(f"DATABASE_URL missing in {DATABASE_ENV_FILE}")


def connect() -> pymysql.Connection:
    url = urlparse(database_url())
    return pymysql.connect(
        host=url.hostname,
        port=url.port or 3306,
        user=unquote(url.username or ""),
        password=unquote(url.password or ""),
        database=url.path.lstrip("/"),
        charset="utf8mb4",
        autocommit=False,
    )


def rows(frame: pd.DataFrame, columns: list[str]) -> list[tuple]:
    clean = frame[columns].astype(object).where(frame[columns].notna(), None)
    return [tuple(row) for row in clean.itertuples(index=False, name=None)]


def insert(cursor, table: str, columns: list[str], values: list[tuple]) -> None:
    statement = (
        f"INSERT INTO {TABLE_PREFIX}{table} ({', '.join(columns)}) "
        f"VALUES ({', '.join(['%s'] * len(columns))})"
    )
    for start in range(0, len(values), INSERT_BATCH_ROWS):
        cursor.executemany(statement, values[start : start + INSERT_BATCH_ROWS])


def main() -> None:
    run = json.loads((OUTPUT_DIR / "run.json").read_text())
    built_at = datetime.fromisoformat(run["built_at"]).replace(tzinfo=None)
    segments = pd.read_parquet(OUTPUT_DIR / "segments.parquet")
    edges = pd.read_parquet(OUTPUT_DIR / "edges.parquet")
    nodes = pd.read_parquet(OUTPUT_DIR / "nodes.parquet")

    connection = connect()
    try:
        with connection.cursor() as cursor:
            for table in ("road_edge", "road_node", "road_segment"):
                cursor.execute(f"DELETE FROM {TABLE_PREFIX}{table}")
            insert(
                cursor,
                "road_segment",
                [*SEGMENT_COLUMNS, "pipeline_run_id", "built_at"],
                [(*row, run["id"], built_at) for row in rows(segments, SEGMENT_COLUMNS)],
            )
            insert(cursor, "road_node", NODE_COLUMNS, rows(nodes, NODE_COLUMNS))
            insert(cursor, "road_edge", EDGE_COLUMNS, rows(edges, EDGE_COLUMNS))
            # Assessments of segments that no longer exist would otherwise
            # linger forever: the hourly job only upserts current segments.
            cursor.execute(
                f"DELETE assessment FROM {TABLE_PREFIX}segment_risk_assessment assessment "
                f"LEFT JOIN {TABLE_PREFIX}road_segment segment ON segment.id = assessment.segment_id "
                "WHERE segment.id IS NULL"
            )
            insert(
                cursor,
                "risk_pipeline_run",
                ["id", "area", "segments", "nodes", "edges", "sources", "finished_at"],
                [
                    (
                        run["id"],
                        run["area"],
                        run["segments"],
                        run["nodes"],
                        run["edges"],
                        json.dumps(run["sources"]),
                        datetime.now(),
                    )
                ],
            )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    print(f"Loaded run {run['id']}: {run['segments']} segments, {run['nodes']} nodes, {run['edges']} edges")


if __name__ == "__main__":
    main()
