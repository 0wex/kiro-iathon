import { describe, expect, it } from "vitest";

import { riskLevelForScore, scoreCurrentRisk, scoreSegmentRisk } from "./score";
import type { SegmentConditions, SegmentStaticFeatures } from "./types";

// Matucana-like PE-22 segment: very high mass-movement class, steep valley
// walls, next to the Rímac and with past huaicos.
const susceptibleSegment: SegmentStaticFeatures = {
	terrainSlopeDeg: 38,
	massMovementSusceptibility: 5,
	floodSusceptibility: 3,
	waterDistanceM: 120,
	historicalEventCount: 4,
};

const flatSegment: SegmentStaticFeatures = {
	terrainSlopeDeg: 2,
	massMovementSusceptibility: 1,
	floodSusceptibility: 1,
	waterDistanceM: null,
	historicalEventCount: 0,
};

const dry: SegmentConditions = {
	forecastPrecipitationMm: 0,
	antecedentPrecipitationMm: 0,
	officialAlertSeverity: null,
};

const heavyRain: SegmentConditions = {
	forecastPrecipitationMm: 30,
	antecedentPrecipitationMm: 50,
	officialAlertSeverity: null,
};

describe("scoreSegmentRisk", () => {
	it("keeps a susceptible segment low on a dry day", () => {
		const assessment = scoreSegmentRisk(susceptibleSegment, dry);

		expect(assessment.score).toBeLessThan(25);
		expect(assessment.level).toBe("low");
		expect(assessment.components.trigger).toBe(0);
	});

	it("raises a susceptible segment to very high under heavy rain", () => {
		const assessment = scoreSegmentRisk(susceptibleSegment, heavyRain);

		expect(assessment.score).toBeGreaterThanOrEqual(75);
		expect(assessment.level).toBe("very_high");
		expect(assessment.components.forecastRain).toBe(1);
	});

	it("keeps a flat segment far from rivers low under the same rain", () => {
		const assessment = scoreSegmentRisk(flatSegment, heavyRain);

		expect(assessment.score).toBeLessThan(25);
		expect(assessment.components.floodExposure).toBe(0);
	});

	it("adds official alerts on top of the environmental score", () => {
		const withoutAlert = scoreSegmentRisk(flatSegment, dry);
		const withCriticalAlert = scoreSegmentRisk(flatSegment, {
			...dry,
			officialAlertSeverity: "critical",
		});
		const withWarning = scoreSegmentRisk(flatSegment, {
			...dry,
			officialAlertSeverity: "warning",
		});

		expect(withCriticalAlert.score).toBeGreaterThan(withWarning.score);
		expect(withWarning.score).toBeGreaterThan(withoutAlert.score);
		expect(withCriticalAlert.components.officialAlert).toBe(1);
	});

	it("uses a neutral prior for missing static features instead of zero", () => {
		const unknown = scoreSegmentRisk(
			{
				terrainSlopeDeg: null,
				massMovementSusceptibility: null,
				floodSusceptibility: null,
				waterDistanceM: null,
				historicalEventCount: 0,
			},
			heavyRain,
		);

		expect(unknown.components.massMovement).toBe(0.5);
		expect(unknown.components.slope).toBe(0.5);
		expect(unknown.score).toBeGreaterThan(
			scoreSegmentRisk(flatSegment, heavyRain).score,
		);
	});

	it("treats missing weather as no rain", () => {
		const assessment = scoreSegmentRisk(susceptibleSegment, {
			forecastPrecipitationMm: null,
			antecedentPrecipitationMm: null,
			officialAlertSeverity: null,
		});

		expect(assessment.components.trigger).toBe(0);
	});

	it("caps the score at 100", () => {
		const assessment = scoreSegmentRisk(
			{ ...susceptibleSegment, historicalEventCount: 50 },
			{ ...heavyRain, officialAlertSeverity: "critical" },
		);

		expect(assessment.score).toBe(100);
	});
});

describe("riskLevelForScore", () => {
	it("maps score bands to levels", () => {
		expect(riskLevelForScore(0)).toBe("low");
		expect(riskLevelForScore(24.9)).toBe("low");
		expect(riskLevelForScore(25)).toBe("moderate");
		expect(riskLevelForScore(50)).toBe("high");
		expect(riskLevelForScore(75)).toBe("very_high");
	});
});

describe("scoreCurrentRisk", () => {
	it("scores current conditions as the same segment without forecast rain", () => {
		const forecastAssessment = scoreSegmentRisk(susceptibleSegment, heavyRain);
		const withoutForecast = scoreSegmentRisk(susceptibleSegment, {
			...heavyRain,
			forecastPrecipitationMm: 0,
		});

		expect(scoreCurrentRisk(forecastAssessment.components)).toBeCloseTo(
			withoutForecast.score,
		);
	});

	it("keeps official alerts in the current score", () => {
		const alerted = scoreSegmentRisk(flatSegment, {
			...dry,
			officialAlertSeverity: "critical",
		});

		expect(scoreCurrentRisk(alerted.components)).toBeCloseTo(alerted.score);
	});
});
