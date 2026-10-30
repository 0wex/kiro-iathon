import type {
	RiskComponents,
	RiskLevel,
} from "@hack-the-andes-project/db/schema/risk";

import {
	ANTECEDENT_RAIN_SATURATION_MM,
	ANTECEDENT_RAIN_TRIGGER_WEIGHT,
	DRY_TRIGGER_FLOOR,
	ENVIRONMENTAL_WEIGHT,
	FLOOD_MAX_CLASS,
	FLOOD_MIN_CLASS,
	FORECAST_RAIN_SATURATION_MM_PER_DAY,
	HISTORY_SATURATION_EVENTS,
	MASS_MOVEMENT_MAX_CLASS,
	MASS_MOVEMENT_MIN_CLASS,
	MISSING_FEATURE_PRIOR,
	OFFICIAL_ALERT_FACTOR,
	OFFICIAL_ALERT_WEIGHT,
	RISK_LEVEL_MIN_SCORES,
	RISK_SCORE_MAX,
	SLOPE_SATURATION_DEG,
	STATIC_WEIGHTS,
	WATER_PROXIMITY_RANGE_M,
} from "./constants";
import type {
	SegmentConditions,
	SegmentRiskScore,
	SegmentStaticFeatures,
} from "./types";

function clampUnit(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function normalizeClass(
	value: number | null,
	minClass: number,
	maxClass: number,
): number {
	if (value === null) {
		return MISSING_FEATURE_PRIOR;
	}
	return clampUnit((value - minClass) / (maxClass - minClass));
}

export function riskLevelForScore(score: number): RiskLevel {
	if (score >= RISK_LEVEL_MIN_SCORES.very_high) {
		return "very_high";
	}
	if (score >= RISK_LEVEL_MIN_SCORES.high) {
		return "high";
	}
	if (score >= RISK_LEVEL_MIN_SCORES.moderate) {
		return "moderate";
	}
	return "low";
}

function combineRiskScore(
	staticSusceptibility: number,
	trigger: number,
	officialAlert: number,
): number {
	return (
		RISK_SCORE_MAX *
		clampUnit(
			ENVIRONMENTAL_WEIGHT *
				staticSusceptibility *
				(DRY_TRIGGER_FLOOR + (1 - DRY_TRIGGER_FLOOR) * trigger) +
				OFFICIAL_ALERT_WEIGHT * officialAlert,
		)
	);
}

// Relative heuristic index in [0, 100]: static susceptibility scaled by a
// rain trigger, plus official alerts. It is not a calibrated probability.
export function scoreSegmentRisk(
	features: SegmentStaticFeatures,
	conditions: SegmentConditions,
): SegmentRiskScore {
	const massMovement = normalizeClass(
		features.massMovementSusceptibility,
		MASS_MOVEMENT_MIN_CLASS,
		MASS_MOVEMENT_MAX_CLASS,
	);
	const slope =
		features.terrainSlopeDeg === null
			? MISSING_FEATURE_PRIOR
			: clampUnit(features.terrainSlopeDeg / SLOPE_SATURATION_DEG);
	// No river within the pipeline's search radius means no fluvial exposure.
	const waterProximity =
		features.waterDistanceM === null
			? 0
			: clampUnit(1 - features.waterDistanceM / WATER_PROXIMITY_RANGE_M);
	const floodExposure =
		normalizeClass(
			features.floodSusceptibility,
			FLOOD_MIN_CLASS,
			FLOOD_MAX_CLASS,
		) * waterProximity;
	const history = clampUnit(
		features.historicalEventCount / HISTORY_SATURATION_EVENTS,
	);
	const staticSusceptibility =
		STATIC_WEIGHTS.massMovement * massMovement +
		STATIC_WEIGHTS.slope * slope +
		STATIC_WEIGHTS.floodExposure * floodExposure +
		STATIC_WEIGHTS.history * history;

	const forecastRain = clampUnit(
		(conditions.forecastPrecipitationMm ?? 0) /
			FORECAST_RAIN_SATURATION_MM_PER_DAY,
	);
	const antecedentRain = clampUnit(
		(conditions.antecedentPrecipitationMm ?? 0) / ANTECEDENT_RAIN_SATURATION_MM,
	);
	const trigger =
		1 -
		(1 - forecastRain) * (1 - ANTECEDENT_RAIN_TRIGGER_WEIGHT * antecedentRain);
	const officialAlert = conditions.officialAlertSeverity
		? OFFICIAL_ALERT_FACTOR[conditions.officialAlertSeverity]
		: 0;

	const score = combineRiskScore(staticSusceptibility, trigger, officialAlert);

	return {
		score,
		level: riskLevelForScore(score),
		components: {
			staticSusceptibility,
			massMovement,
			slope,
			floodExposure,
			history,
			trigger,
			forecastRain,
			antecedentRain,
			officialAlert,
		},
	};
}

// The "now" horizon of a stored assessment: what is already on the ground
// (antecedent rain and active alerts) without the forecast it was scored with.
export function scoreCurrentRisk(components: RiskComponents): number {
	return combineRiskScore(
		components.staticSusceptibility,
		ANTECEDENT_RAIN_TRIGGER_WEIGHT * components.antecedentRain,
		components.officialAlert,
	);
}
