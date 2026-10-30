import {
	IMPUTED_FLOOD_CLASS,
	IMPUTED_MASS_MOVEMENT_CLASS,
	IMPUTED_TERRAIN_SLOPE_DEG,
	IMPUTED_WATER_DISTANCE_M,
	LIMA_UTC_OFFSET_HOURS,
	MS_PER_HOUR,
	RISK_SCORE_MAX,
} from "./constants";
import type {
	RiskModel,
	SegmentConditions,
	SegmentStaticFeatures,
} from "./types";

// Order must match MODEL_FEATURES in tools/risk-pipeline/illapa_risk/train.py.
export function modelFeatureVector(
	features: SegmentStaticFeatures,
	conditions: SegmentConditions,
	at: Date,
): number[] {
	const limaMonth =
		new Date(at.getTime() + LIMA_UTC_OFFSET_HOURS * MS_PER_HOUR).getUTCMonth() +
		1;
	return [
		features.terrainSlopeDeg ?? IMPUTED_TERRAIN_SLOPE_DEG,
		features.massMovementSusceptibility ?? IMPUTED_MASS_MOVEMENT_CLASS,
		features.floodSusceptibility ?? IMPUTED_FLOOD_CLASS,
		features.waterDistanceM ?? IMPUTED_WATER_DISTANCE_M,
		features.historicalEventCount,
		conditions.antecedentPrecipitationMm ?? 0,
		conditions.forecastPrecipitationMm ?? 0,
		limaMonth,
	];
}

// Percentile of `probability` among the training quantiles, scaled to 0–100.
// Rare events leave many tied quantiles near zero; ties take their mean rank
// so a typical dry-day probability lands mid-scale instead of at either end.
export function relativeModelScore(
	model: RiskModel,
	probability: number,
): number {
	const quantiles = model.scoreQuantiles;
	const lastIndex = quantiles.length - 1;
	const firstTie = quantiles.indexOf(probability);
	if (firstTie !== -1) {
		const lastTie = quantiles.lastIndexOf(probability);
		return (((firstTie + lastTie) / 2) * RISK_SCORE_MAX) / lastIndex;
	}
	const upperIndex = quantiles.findIndex((quantile) => quantile > probability);
	if (upperIndex === 0) return 0;
	if (upperIndex === -1) return RISK_SCORE_MAX;
	const lower = quantiles[upperIndex - 1] ?? 0;
	const upper = quantiles[upperIndex] ?? 0;
	const rank = upperIndex - 1 + (probability - lower) / (upper - lower);
	return (rank * RISK_SCORE_MAX) / lastIndex;
}
