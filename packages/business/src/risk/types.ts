import type {
	RiskComponents,
	RiskLevel,
} from "@hack-the-andes-project/db/schema/risk";
import type { IncidentSeverity } from "@hack-the-andes-project/db/schema/scraper";

export interface SegmentStaticFeatures {
	terrainSlopeDeg: number | null;
	massMovementSusceptibility: number | null;
	floodSusceptibility: number | null;
	waterDistanceM: number | null;
	historicalEventCount: number;
}

export interface SegmentConditions {
	// Wettest forecast day inside the horizon, not the horizon total, so 24 h
	// and 72 h scores stay on the same scale.
	forecastPrecipitationMm: number | null;
	antecedentPrecipitationMm: number | null;
	officialAlertSeverity: IncidentSeverity | null;
}

export interface SegmentRiskScore {
	score: number;
	level: RiskLevel;
	components: RiskComponents;
}

// Shape of the module tools/risk-pipeline/illapa_risk/train.py generates
// into model.generated.ts once a trained model beats the heuristic.
export interface RiskModel {
	version: string;
	featureNames: readonly string[];
	// Out-of-fold probability quantiles (ascending) used to turn probabilities
	// into the same relative 0–100 index the heuristic produces.
	scoreQuantiles: readonly number[];
	predictProbability: (features: number[]) => number;
}
