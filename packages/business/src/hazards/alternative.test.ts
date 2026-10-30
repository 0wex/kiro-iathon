import type { LineString } from "geojson";
import { describe, expect, it } from "vitest";

import { chooseAlternativeRoute } from "./alternative";
import {
	CARRETERA_CENTRAL,
	LIMA_HUANCAYO_ROUTE,
	pointIncident,
	TICLIO,
} from "./test-fixtures";
import type { RouteCandidate } from "./types";

function shiftedRoute(latOffset: number): LineString {
	return {
		type: "LineString",
		coordinates: CARRETERA_CENTRAL.coordinates.map((vertex) => [
			vertex[0] ?? 0,
			(vertex[1] ?? 0) + latOffset,
		]),
	};
}

const shiftedNorth: RouteCandidate = {
	geometry: shiftedRoute(0.05),
	distanceM: 330_000,
	durationS: 8 * 3600,
};

const shiftedSouth: RouteCandidate = {
	geometry: shiftedRoute(-0.05),
	distanceM: 340_000,
	durationS: 9 * 3600,
};

const tooLong: RouteCandidate = { ...shiftedNorth, durationS: 12 * 3600 };

describe("chooseAlternativeRoute", () => {
	it("returns the fastest candidate that avoids every alertable hazard", () => {
		const chosen = chooseAlternativeRoute({
			candidates: [LIMA_HUANCAYO_ROUTE, shiftedSouth, shiftedNorth],
			incidents: [pointIncident("ticlio", TICLIO)],
			originalDurationS: LIMA_HUANCAYO_ROUTE.durationS,
		});
		expect(chosen).toBe(shiftedNorth);
	});

	it("rejects candidates longer than the detour ratio", () => {
		const chosen = chooseAlternativeRoute({
			candidates: [LIMA_HUANCAYO_ROUTE, tooLong],
			incidents: [pointIncident("ticlio", TICLIO)],
			originalDurationS: LIMA_HUANCAYO_ROUTE.durationS,
		});
		expect(chosen).toBeNull();
	});

	it("ignores incidents that are not alertable", () => {
		const chosen = chooseAlternativeRoute({
			candidates: [LIMA_HUANCAYO_ROUTE, shiftedNorth],
			incidents: [
				pointIncident("ticlio", TICLIO, {
					category: "road_works",
					severity: "info",
				}),
			],
			originalDurationS: LIMA_HUANCAYO_ROUTE.durationS,
		});
		expect(chosen).toBe(LIMA_HUANCAYO_ROUTE);
	});

	it("returns null when every candidate is hazardous", () => {
		const chosen = chooseAlternativeRoute({
			candidates: [LIMA_HUANCAYO_ROUTE, shiftedNorth],
			incidents: [
				pointIncident("ticlio", TICLIO),
				pointIncident("north", [TICLIO[0], TICLIO[1] + 0.05]),
			],
			originalDurationS: LIMA_HUANCAYO_ROUTE.durationS,
		});
		expect(chosen).toBeNull();
	});
});
