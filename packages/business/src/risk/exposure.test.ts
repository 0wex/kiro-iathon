import type { Polygon } from "geojson";
import { describe, expect, it } from "vitest";

import { MATUCANA, TICLIO } from "../hazards/test-fixtures";
import { countEventsNearby, strongestOfficialAlert } from "./exposure";

const [matucanaLng, matucanaLat] = MATUCANA;
const [ticlioLng, ticlioLat] = TICLIO;
const matucana = { lat: matucanaLat, lng: matucanaLng };
const ticlio = { lat: ticlioLat, lng: ticlioLng };
// ~550 m east of Matucana.
const nearMatucana = { lat: matucanaLat, lng: matucanaLng + 0.005 };
// ~2.2 km east of Matucana.
const farFromMatucana = { lat: matucanaLat, lng: matucanaLng + 0.02 };

const matucanaWarningArea: Polygon = {
	type: "Polygon",
	coordinates: [
		[
			[matucanaLng - 0.1, matucanaLat - 0.1],
			[matucanaLng + 0.1, matucanaLat - 0.1],
			[matucanaLng + 0.1, matucanaLat + 0.1],
			[matucanaLng - 0.1, matucanaLat + 0.1],
			[matucanaLng - 0.1, matucanaLat - 0.1],
		],
	],
};

describe("countEventsNearby", () => {
	it("counts only events inside the radius of each point", () => {
		expect(
			countEventsNearby(
				[matucana, ticlio],
				[nearMatucana, nearMatucana, farFromMatucana],
				1_000,
			),
		).toEqual([2, 0]);
	});

	it("returns zeros when there are no events", () => {
		expect(countEventsNearby([matucana], [], 1_000)).toEqual([0]);
	});
});

describe("strongestOfficialAlert", () => {
	it("matches polygon alerts by containment", () => {
		const alerts = [
			{
				severity: "warning" as const,
				geometry: matucanaWarningArea,
				lat: matucanaLat,
				lng: matucanaLng,
			},
		];

		expect(strongestOfficialAlert(matucana, alerts, 2_000)).toBe("warning");
		expect(strongestOfficialAlert(ticlio, alerts, 2_000)).toBeNull();
	});

	it("matches point alerts by distance and keeps the most severe", () => {
		const alerts = [
			{ severity: "info" as const, geometry: null, ...nearMatucana },
			{ severity: "critical" as const, geometry: null, ...nearMatucana },
			{ severity: "critical" as const, geometry: null, ...ticlio },
		];

		expect(strongestOfficialAlert(matucana, alerts, 2_000)).toBe("critical");
		expect(strongestOfficialAlert(farFromMatucana, alerts, 1_000)).toBeNull();
	});
});
