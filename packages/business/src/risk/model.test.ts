import { describe, expect, it } from "vitest";

import { modelFeatureVector, relativeModelScore } from "./model";
import type { RiskModel } from "./types";

function fakeModel(scoreQuantiles: number[]): RiskModel {
	return {
		version: "test",
		featureNames: [],
		scoreQuantiles,
		predictProbability: () => 0,
	};
}

describe("modelFeatureVector", () => {
	it("orders features like the training script and imputes gaps", () => {
		expect(
			modelFeatureVector(
				{
					terrainSlopeDeg: null,
					massMovementSusceptibility: 5,
					floodSusceptibility: null,
					waterDistanceM: null,
					historicalEventCount: 2,
				},
				{
					forecastPrecipitationMm: 12,
					antecedentPrecipitationMm: null,
					officialAlertSeverity: null,
				},
				new Date("2026-02-01T03:00:00Z"),
			),
		).toEqual([22.5, 5, 2.5, 5_000, 2, 0, 12, 1]);
	});
});

describe("relativeModelScore", () => {
	const model = fakeModel([0, 0.1, 0.2, 0.4, 1]);

	it("interpolates between training quantiles onto 0–100", () => {
		const quartiles = fakeModel([0, 0.1, 0.2, 0.4, 0.8]);

		expect(relativeModelScore(quartiles, 0)).toBe(0);
		expect(relativeModelScore(quartiles, 0.15)).toBeCloseTo(37.5);
		expect(relativeModelScore(quartiles, 0.8)).toBe(100);
		expect(relativeModelScore(quartiles, 0.95)).toBe(100);
		expect(relativeModelScore(model, 0.3)).toBeCloseTo(62.5);
	});

	it("puts tied quantiles at their mean rank", () => {
		const rare = fakeModel([0.01, 0.01, 0.01, 0.01, 0.5]);

		expect(relativeModelScore(rare, 0.01)).toBe(37.5);
	});
});
