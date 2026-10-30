import { describe, expect, it } from "vitest";

import { estimateEta } from "./eta";
import { LIMA_HUANCAYO_ROUTE, MATUCANA, vehicleAt } from "./test-fixtures";

const now = new Date("2026-10-17T12:00:00Z");
const progress = {
	distanceAlongM: 100_000,
	offRouteM: 0,
	remainingDistanceM: 200_000,
};

describe("estimateEta", () => {
	it("uses the live speed when the vehicle is moving", () => {
		const eta = estimateEta({
			route: LIMA_HUANCAYO_ROUTE,
			progress,
			vehicle: vehicleAt(MATUCANA, 72),
			now,
		});
		expect(eta.getTime() - now.getTime()).toBe(10_000 * 1000);
	});

	it("falls back to the route average speed when the vehicle is stopped or has no speed", () => {
		const expectedMs = (200_000 / (300_000 / (7 * 3600))) * 1000;
		const stopped = estimateEta({
			route: LIMA_HUANCAYO_ROUTE,
			progress,
			vehicle: vehicleAt(MATUCANA, 2),
			now,
		});
		const unknown = estimateEta({
			route: LIMA_HUANCAYO_ROUTE,
			progress,
			vehicle: vehicleAt(MATUCANA, null),
			now,
		});
		expect(stopped.getTime() - now.getTime()).toBeCloseTo(expectedMs, 0);
		expect(unknown.getTime() - now.getTime()).toBeCloseTo(expectedMs, 0);
	});
});
