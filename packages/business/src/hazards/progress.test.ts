import { describe, expect, it } from "vitest";

import { OFF_ROUTE_THRESHOLD_M } from "../constants";
import { projectOntoRoute } from "./progress";
import { CARRETERA_CENTRAL, HUANCAYO, LIMA, MATUCANA } from "./test-fixtures";

describe("projectOntoRoute", () => {
	it("places the start of the route at zero progress", () => {
		const progress = projectOntoRoute(CARRETERA_CENTRAL, {
			lng: LIMA[0],
			lat: LIMA[1],
		});
		expect(progress.distanceAlongM).toBe(0);
		expect(progress.offRouteM).toBe(0);
		expect(progress.remainingDistanceM).toBeGreaterThan(200_000);
	});

	it("places the destination at the full route length", () => {
		const progress = projectOntoRoute(CARRETERA_CENTRAL, {
			lng: HUANCAYO[0],
			lat: HUANCAYO[1],
		});
		expect(progress.remainingDistanceM).toBeCloseTo(0, 3);
	});

	it("keeps a vehicle on a vertex on-route", () => {
		const progress = projectOntoRoute(CARRETERA_CENTRAL, {
			lng: MATUCANA[0],
			lat: MATUCANA[1],
		});
		expect(progress.offRouteM).toBeLessThan(1);
		expect(progress.distanceAlongM).toBeGreaterThan(50_000);
		expect(progress.distanceAlongM).toBeLessThan(70_000);
	});

	it("reports a vehicle far from the road as off-route", () => {
		const progress = projectOntoRoute(CARRETERA_CENTRAL, {
			lng: MATUCANA[0],
			lat: MATUCANA[1] - 0.05,
		});
		expect(progress.offRouteM).toBeGreaterThan(OFF_ROUTE_THRESHOLD_M);
	});
});
