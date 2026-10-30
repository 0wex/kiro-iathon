import {
	bigint,
	double,
	index,
	int,
	json,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core";
import type { LineString, MultiLineString } from "geojson";

import { mysqlTable } from "./_table";
import {
	ID_LENGTH_CHARS,
	SEVERITY_LENGTH_CHARS,
	TEXT_LENGTH_CHARS,
	TIMESTAMP_PRECISION_DIGITS,
} from "./constants";

export const RISK_HORIZONS_HOURS = [24, 48, 72] as const;
export type RiskHorizonHours = (typeof RISK_HORIZONS_HOURS)[number];

export const RISK_LEVELS = ["low", "moderate", "high", "very_high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_METHODS = ["heuristic", "model"] as const;
export type RiskMethod = (typeof RISK_METHODS)[number];

const SEGMENT_ID_LENGTH_CHARS = 64;
const ROAD_CODE_LENGTH_CHARS = 32;
const HIGHWAY_LENGTH_CHARS = 32;
const METHOD_LENGTH_CHARS = 16;
const MODEL_VERSION_LENGTH_CHARS = 64;

export interface RiskComponents {
	staticSusceptibility: number;
	massMovement: number;
	slope: number;
	floodExposure: number;
	history: number;
	trigger: number;
	forecastRain: number;
	antecedentRain: number;
	officialAlert: number;
}

// Rows below are produced by the offline pipeline in tools/risk-pipeline and
// replaced wholesale on every load, so they carry the pipeline run that wrote
// them instead of scraper-style first/last seen bookkeeping.
// Static features stay as explicit columns (not json) because both the
// heuristic score and the ML training set read them by name.
export const roadSegment = mysqlTable(
	"road_segment",
	{
		id: varchar("id", { length: SEGMENT_ID_LENGTH_CHARS }).primaryKey(),
		roadCode: varchar("road_code", { length: ROAD_CODE_LENGTH_CHARS }),
		roadName: varchar("road_name", { length: TEXT_LENGTH_CHARS }),
		geometry: json("geometry").$type<LineString | MultiLineString>().notNull(),
		lat: double("lat").notNull(),
		lng: double("lng").notNull(),
		lengthM: double("length_m").notNull(),
		elevationM: double("elevation_m"),
		terrainSlopeDeg: double("terrain_slope_deg"),
		massMovementSusceptibility: int("mass_movement_susceptibility"),
		floodSusceptibility: int("flood_susceptibility"),
		waterDistanceM: double("water_distance_m"),
		pipelineRunId: varchar("pipeline_run_id", {
			length: ID_LENGTH_CHARS,
		}).notNull(),
		builtAt: timestamp("built_at", {
			fsp: TIMESTAMP_PRECISION_DIGITS,
		}).notNull(),
	},
	(table) => [
		index("roadSegment_lat_lng_idx").on(table.lat, table.lng),
		index("roadSegment_roadCode_idx").on(table.roadCode),
	],
);

// OSM node ids exceed 2^31 but stay far below 2^53, so number mode is exact.
export const roadNode = mysqlTable(
	"road_node",
	{
		id: bigint("id", { mode: "number" }).primaryKey(),
		lat: double("lat").notNull(),
		lng: double("lng").notNull(),
	},
	(table) => [index("roadNode_lat_lng_idx").on(table.lat, table.lng)],
);

// Directed edges exactly as OSMnx emits them: a two-way street is two rows.
// `lat`/`lng` is the edge midpoint so routing can load a bounding box.
export const roadEdge = mysqlTable(
	"road_edge",
	{
		id: varchar("id", { length: SEGMENT_ID_LENGTH_CHARS }).primaryKey(),
		fromNodeId: bigint("from_node_id", { mode: "number" }).notNull(),
		toNodeId: bigint("to_node_id", { mode: "number" }).notNull(),
		segmentId: varchar("segment_id", { length: SEGMENT_ID_LENGTH_CHARS }),
		roadCode: varchar("road_code", { length: ROAD_CODE_LENGTH_CHARS }),
		roadName: varchar("road_name", { length: TEXT_LENGTH_CHARS }),
		highway: varchar("highway", { length: HIGHWAY_LENGTH_CHARS }).notNull(),
		lengthM: double("length_m").notNull(),
		travelTimeS: double("travel_time_s").notNull(),
		geometry: json("geometry").$type<LineString>().notNull(),
		lat: double("lat").notNull(),
		lng: double("lng").notNull(),
	},
	(table) => [
		index("roadEdge_lat_lng_idx").on(table.lat, table.lng),
		index("roadEdge_segmentId_idx").on(table.segmentId),
	],
);

// Only the latest assessment per (segment, horizon) is kept: the scraper's
// hourly job upserts in place. Scores are relative heuristic indices in
// [0, 100], not calibrated probabilities.
export const segmentRiskAssessment = mysqlTable(
	"segment_risk_assessment",
	{
		id: varchar("id", { length: ID_LENGTH_CHARS }).primaryKey(),
		segmentId: varchar("segment_id", {
			length: SEGMENT_ID_LENGTH_CHARS,
		}).notNull(),
		horizonHours: int("horizon_hours").$type<RiskHorizonHours>().notNull(),
		score: double("score").notNull(),
		level: varchar("level", { length: SEVERITY_LENGTH_CHARS })
			.$type<RiskLevel>()
			.notNull(),
		method: varchar("method", { length: METHOD_LENGTH_CHARS })
			.$type<RiskMethod>()
			.notNull(),
		modelVersion: varchar("model_version", {
			length: MODEL_VERSION_LENGTH_CHARS,
		}).notNull(),
		components: json("components").$type<RiskComponents>().notNull(),
		forecastPrecipitationMm: double("forecast_precipitation_mm"),
		antecedentPrecipitationMm: double("antecedent_precipitation_mm"),
		weatherFetchedAt: timestamp("weather_fetched_at", {
			fsp: TIMESTAMP_PRECISION_DIGITS,
		}),
		validFrom: timestamp("valid_from", {
			fsp: TIMESTAMP_PRECISION_DIGITS,
		}).notNull(),
		validUntil: timestamp("valid_until", {
			fsp: TIMESTAMP_PRECISION_DIGITS,
		}).notNull(),
		assessedAt: timestamp("assessed_at", {
			fsp: TIMESTAMP_PRECISION_DIGITS,
		}).notNull(),
	},
	(table) => [
		uniqueIndex("segmentRiskAssessment_segment_horizon_idx").on(
			table.segmentId,
			table.horizonHours,
		),
		index("segmentRiskAssessment_horizon_score_idx").on(
			table.horizonHours,
			table.score,
		),
	],
);

export const riskPipelineRun = mysqlTable("risk_pipeline_run", {
	id: varchar("id", { length: ID_LENGTH_CHARS }).primaryKey(),
	area: varchar("area", { length: TEXT_LENGTH_CHARS }).notNull(),
	segments: int("segments").notNull(),
	nodes: int("nodes").notNull(),
	edges: int("edges").notNull(),
	sources: json("sources").$type<Record<string, string>>().notNull(),
	finishedAt: timestamp("finished_at", {
		fsp: TIMESTAMP_PRECISION_DIGITS,
	}).notNull(),
});
