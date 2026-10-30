import * as turfBuffer from "@turf/buffer";
import { describe, expect, it, vi } from "vitest";

import { findHazardsAhead } from "./hazards-ahead";
import {
	CHOSICA,
	JAUJA,
	LA_OROYA,
	LIMA_HUANCAYO_ROUTE,
	MATUCANA,
	pointIncident,
	SAN_MATEO,
	TICLIO,
	vehicleAt,
} from "./test-fixtures";

vi.mock("@turf/buffer", { spy: true });

describe("findHazardsAhead", () => {
	it("returns hazards ahead sorted by distance and drops those behind", () => {
		const hazards = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(MATUCANA),
			incidents: [
				pointIncident("ticlio", TICLIO),
				pointIncident("chosica", CHOSICA),
				pointIncident("san-mateo", SAN_MATEO),
			],
		});
		expect(hazards.map((hazard) => hazard.incident.id)).toEqual([
			"san-mateo",
			"ticlio",
		]);
		expect(hazards[0]?.distanceAheadM).toBeGreaterThan(10_000);
		expect(hazards[0]?.distanceAheadM).toBeLessThan(20_000);
	});

	it("drops hazards beyond the lookahead", () => {
		const hazards = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(MATUCANA),
			incidents: [pointIncident("jauja", JAUJA)],
			lookaheadM: 50_000,
		});
		expect(hazards).toEqual([]);
	});

	it("ignores non-alertable incidents and incidents without a location", () => {
		const hazards = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(MATUCANA),
			incidents: [
				pointIncident("medical", TICLIO, { category: "medical" }),
				pointIncident("nowhere", TICLIO, {
					geometry: null,
					lat: null,
					lng: null,
				}),
			],
		});
		expect(hazards).toEqual([]);
	});

	it("falls back to lat/lng when the incident has no geometry", () => {
		const hazards = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(MATUCANA),
			incidents: [pointIncident("ticlio", TICLIO, { geometry: null })],
		});
		expect(hazards.map((hazard) => hazard.incident.id)).toEqual(["ticlio"]);
	});

	it("respects the buffer tolerance around the route", () => {
		const nearRoad: [number, number] = [TICLIO[0], TICLIO[1] + 0.003];
		const farFromRoad: [number, number] = [TICLIO[0], TICLIO[1] + 0.03];
		const incidents = [
			pointIncident("near", nearRoad),
			pointIncident("far", farFromRoad),
		];
		const withDefaultBuffer = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(MATUCANA),
			incidents,
		});
		expect(withDefaultBuffer.map((hazard) => hazard.incident.id)).toEqual([
			"near",
		]);
		const withWideBuffer = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(MATUCANA),
			incidents,
			bufferM: 5_000,
		});
		expect(withWideBuffer.map((hazard) => hazard.incident.id)).toEqual([
			"near",
			"far",
		]);
	});

	it("detects a polygon hazard the route crosses", () => {
		const flood = pointIncident("oroya-flood", LA_OROYA, {
			category: "flood",
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[LA_OROYA[0] - 0.02, LA_OROYA[1] - 0.02],
						[LA_OROYA[0] + 0.02, LA_OROYA[1] - 0.02],
						[LA_OROYA[0] + 0.02, LA_OROYA[1] + 0.02],
						[LA_OROYA[0] - 0.02, LA_OROYA[1] + 0.02],
						[LA_OROYA[0] - 0.02, LA_OROYA[1] - 0.02],
					],
				],
			},
		});
		const hazards = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(TICLIO),
			incidents: [flood],
		});
		expect(hazards).toHaveLength(1);
		expect(hazards[0]?.distanceAheadM).toBeGreaterThan(25_000);
		expect(hazards[0]?.distanceAheadM).toBeLessThan(35_000);
	});

	it("reports a polygon hazard the vehicle is already inside at zero distance", () => {
		const storm = pointIncident("storm", TICLIO, {
			category: "weather",
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[TICLIO[0] - 0.1, TICLIO[1] - 0.1],
						[TICLIO[0] + 0.1, TICLIO[1] - 0.1],
						[TICLIO[0] + 0.1, TICLIO[1] + 0.1],
						[TICLIO[0] - 0.1, TICLIO[1] + 0.1],
						[TICLIO[0] - 0.1, TICLIO[1] - 0.1],
					],
				],
			},
		});
		const hazards = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(TICLIO),
			incidents: [storm],
		});
		expect(hazards).toHaveLength(1);
		expect(hazards[0]?.distanceAheadM).toBe(0);
	});

	it("estimates time to hazard from live speed or the route average", () => {
		const incidents = [pointIncident("ticlio", TICLIO)];
		const [fast] = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(MATUCANA, 72),
			incidents,
		});
		const [parked] = findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(MATUCANA, 0),
			incidents,
		});
		expect(fast?.etaSeconds).toBeCloseTo((fast?.distanceAheadM ?? 0) / 20, 3);
		expect(parked?.etaSeconds).toBeCloseTo(
			(parked?.distanceAheadM ?? 0) / (300_000 / (7 * 3600)),
			3,
		);
	});
});

it("filters distant polygon hazards before buffering them", () => {
	const buffer = vi.mocked(turfBuffer.buffer);
	buffer.mockClear();
	const farPolygon = pointIncident("distant", [0, 0], {
		geometry: {
			type: "Polygon",
			coordinates: [
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1],
					[0, 0],
				],
			],
		},
	});
	expect(
		findHazardsAhead({
			route: LIMA_HUANCAYO_ROUTE,
			vehicle: vehicleAt(MATUCANA),
			incidents: [farPolygon],
		}),
	).toEqual([]);
	expect(buffer).toHaveBeenCalledTimes(1);
	expect(buffer.mock.calls[0]?.[0]).toEqual(LIMA_HUANCAYO_ROUTE.geometry);
	buffer.mockClear();
});
