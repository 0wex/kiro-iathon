import type { IncidentSeverity } from "@hack-the-andes-project/db/schema/scraper";

export const HEURISTIC_MODEL_VERSION = "heuristic-v1";

export const MASS_MOVEMENT_MIN_CLASS = 1;
export const MASS_MOVEMENT_MAX_CLASS = 5;
export const FLOOD_MIN_CLASS = 1;
export const FLOOD_MAX_CLASS = 4;
export const MISSING_FEATURE_PRIOR = 0.5;

export const SLOPE_SATURATION_DEG = 45;
export const WATER_PROXIMITY_RANGE_M = 1_000;
export const HISTORY_SATURATION_EVENTS = 5;
export const HISTORY_RADIUS_M = 1_000;

// SENAMHI classifies >20 mm/day as extreme rain for most of the central
// Andes; saturating a little above it keeps the coast and sierra comparable.
export const FORECAST_RAIN_SATURATION_MM_PER_DAY = 25;
export const ANTECEDENT_RAIN_SATURATION_MM = 60;
export const ANTECEDENT_RAIN_WINDOW_DAYS = 3;
export const ANTECEDENT_RAIN_TRIGGER_WEIGHT = 0.5;

export const STATIC_WEIGHTS = {
	massMovement: 0.4,
	slope: 0.2,
	floodExposure: 0.25,
	history: 0.15,
} as const;

// Susceptible terrain keeps a baseline even without rain (rockfall, old
// slides), but rain is what turns susceptibility into a near-term risk.
export const DRY_TRIGGER_FLOOR = 0.2;
export const ENVIRONMENTAL_WEIGHT = 0.9;
export const OFFICIAL_ALERT_WEIGHT = 0.3;

export const OFFICIAL_ALERT_FACTOR: Record<IncidentSeverity, number> = {
	info: 0.2,
	warning: 0.6,
	critical: 1,
};

export const RISK_SCORE_MAX = 100;
export const RISK_LEVEL_MIN_SCORES = {
	moderate: 25,
	high: 50,
	very_high: 75,
} as const;

export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const OPEN_METEO_REQUEST_TIMEOUT_MS = 20_000;
export const OPEN_METEO_RATE_LIMIT_RETRY_DELAY_MS = 61_000;
export const HTTP_TOO_MANY_REQUESTS = 429;
// One extra forecast day so a 72 h horizon starting mid-day is fully covered.
export const OPEN_METEO_FORECAST_DAYS = 4;
// Weather models resolve ~9–13 km, so segments sharing a 0.1° cell share one
// forecast; this keeps hourly runs inside Open-Meteo's free daily budget.
export const WEATHER_GRID_DEG = 0.1;
export const WEATHER_REQUEST_BATCH_POINTS = 100;
export const HOURS_PER_DAY = 24;
export const MS_PER_HOUR = 3_600_000;
export const SECONDS_PER_HOUR = 3600;
export const METERS_PER_DEGREE_LATITUDE = 111_320;
export const OFFICIAL_ALERT_RADIUS_M = 2_000;

export const HISTORY_EVENT_CATEGORIES = ["landslide", "flood"] as const;
export const OFFICIAL_ALERT_CATEGORIES = [
	"rain_warning",
	"flood_warning",
	"weather",
	"landslide",
	"flood",
	"road_block",
] as const;
export const ASSESSMENT_BOUNDS_MARGIN_DEG = 0.05;

// Safest-route cost: each second on a segment scored 100 counts as
// 1 + RISK_TIME_PENALTY_FACTOR seconds, so the router accepts detours that are
// meaningfully slower only when they avoid high scores.
export const RISK_TIME_PENALTY_FACTOR = 3;
export const HIGH_RISK_MIN_SCORE = 50;
export const MAX_SNAP_DISTANCE_M = 5_000;
// Upper bound on road speed keeps the A* heuristic admissible.
export const MAX_ROAD_SPEED_MPS = 120 / 3.6;
export const ROUTING_BOUNDS_MARGIN_DEG = 0.3;
export const ROUTING_BOUNDS_SPAN_RATIO = 0.5;
// Simplified OSMnx edges in the Andes can run several km, so closures look for
// candidate edges by midpoint well beyond the match radius.
export const CLOSURE_CANDIDATE_RADIUS_DEG = 0.05;
export const CLOSURE_MATCH_RADIUS_M = 300;
export const GEOMETRY_FETCH_BATCH_ROWS = 1_000;

// Imputation for model features; mirrored by IMPUTED_FEATURES in
// tools/risk-pipeline/illapa_risk/train.py so training and inference agree.
export const IMPUTED_TERRAIN_SLOPE_DEG = 22.5;
export const IMPUTED_MASS_MOVEMENT_CLASS = 3;
export const IMPUTED_FLOOD_CLASS = 2.5;
// The pipeline's WATER_SEARCH_RADIUS_M: no river found within it.
export const IMPUTED_WATER_DISTANCE_M = 5_000;
export const LIMA_UTC_OFFSET_HOURS = -5;
