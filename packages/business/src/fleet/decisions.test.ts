import { describe, expect, it } from "vitest";

import { OFF_ROUTE_THRESHOLD_M, TRIP_ARRIVAL_RADIUS_M } from "../constants";
import type { HazardAhead } from "../hazards/types";
import type { ProviderPosition } from "../providers/types";
import {
	decideTripProgress,
	formatHazardAlert,
	planPositionUpdates,
} from "./decisions";

describe("trip progress decisions", () => {
	it("completes an on-route vehicle within the arrival radius", () => {
		expect(
			decideTripProgress(
				{
					distanceAlongM: 10_000,
					remainingDistanceM: 100,
					offRouteM: 0,
				},
				100,
			),
		).toEqual({ arrived: true, reroute: false });
	});
	it("completes at the arrival boundary", () => {
		expect(
			decideTripProgress(
				{
					distanceAlongM: 10_000,
					remainingDistanceM: TRIP_ARRIVAL_RADIUS_M,
					offRouteM: 0,
				},
				TRIP_ARRIVAL_RADIUS_M,
			).arrived,
		).toBe(true);
	});
	it("reroutes a vehicle far from the destination even when it projects onto the endpoint", () => {
		expect(
			decideTripProgress(
				{
					distanceAlongM: 10_000,
					remainingDistanceM: 0,
					offRouteM: OFF_ROUTE_THRESHOLD_M + 1,
				},
				OFF_ROUTE_THRESHOLD_M + 1,
			),
		).toEqual({ arrived: false, reroute: true });
	});
	it("does not reroute at the off-route threshold", () => {
		expect(
			decideTripProgress(
				{
					distanceAlongM: 0,
					remainingDistanceM: 10_000,
					offRouteM: OFF_ROUTE_THRESHOLD_M,
				},
				10_000,
			).reroute,
		).toBe(false);
	});
});

describe("Spanish hazard messages", () => {
	const hazard: HazardAhead = {
		incident: {
			id: "landslide",
			category: "landslide",
			severity: "critical",
			title: "Huaico en PE-22 km 45",
			geometry: null,
			lat: null,
			lng: null,
		},
		severity: "critical",
		distanceAheadM: 18_000,
		etaSeconds: 840,
	};
	it("includes the incident location, distance and ETA", () => {
		expect(formatHazardAlert(hazard)).toEqual({
			title: "Huaico en PE-22 km 45",
			message: "Huaico en PE-22 km 45 a 18 km (ETA 14 min)",
		});
	});
	it("uses meters nearby and does not invent an unknown ETA", () => {
		expect(
			formatHazardAlert({ ...hazard, distanceAheadM: 250, etaSeconds: null })
				.message,
		).toBe("Huaico en PE-22 km 45 a 250 m (ETA no disponible)");
	});
});

describe("position update planning", () => {
	const storedAt = new Date("2026-10-17T12:00:00Z");
	const position: ProviderPosition = {
		externalId: "truck",
		lat: -12,
		lng: -77,
		speedKmh: 60,
		heading: null,
		recordedAt: storedAt,
	};
	const stored = {
		id: "vehicle",
		externalId: "truck",
		lastPositionAt: storedAt,
	};
	it("ignores repeated and out-of-order positions", () => {
		expect(
			planPositionUpdates(
				[stored],
				[
					position,
					{ ...position, recordedAt: new Date("2026-10-17T11:59:00Z") },
				],
			),
		).toEqual([]);
	});
	it("chooses the newest reading regardless of provider ordering", () => {
		const latest = {
			...position,
			recordedAt: new Date("2026-10-17T12:02:00Z"),
		};
		expect(
			planPositionUpdates(
				[stored],
				[
					latest,
					position,
					{ ...position, recordedAt: new Date("2026-10-17T12:01:00Z") },
				],
			),
		).toEqual([{ vehicleId: stored.id, position: latest }]);
	});
	it("accepts the first position and ignores unknown external IDs", () => {
		expect(
			planPositionUpdates(
				[{ ...stored, lastPositionAt: null }],
				[position, { ...position, externalId: "unknown" }],
			),
		).toEqual([{ vehicleId: stored.id, position }]);
	});
	it("does not erase a stored position when GPS data is missing", () => {
		expect(planPositionUpdates([stored], [])).toEqual([]);
	});
});
