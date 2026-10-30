import { describe, expect, it } from "vitest";

import { geometryCenter } from "../lib/geo";
import { extractRoadCodes } from "./sutran";

describe("extractRoadCodes", () => {
	it("normalises the spacing and dash variants seen in SUTRAN route names", () => {
		expect(
			extractRoadCodes("Ruta AN – 527 Ancos (Emp PE-3N) – Emp PE -3NA"),
		).toEqual(["AN-527", "PE-3N", "PE-3NA"]);
		expect(
			extractRoadCodes("Ruta AN – 541 (5.00 Km) y PE-12.A (23.00 Km)"),
		).toEqual(["AN-541", "PE-12"]);
	});

	it("returns nothing when no code is present", () => {
		expect(extractRoadCodes("")).toEqual([]);
	});
});

describe("geometryCenter", () => {
	it("returns the Turf centroid of a line in lat/lng", () => {
		expect(
			geometryCenter({
				type: "LineString",
				coordinates: [
					[-77, -12],
					[-75, -10],
				],
			}),
		).toEqual({ lat: -11, lng: -76 });
	});

	it("returns null without a geometry", () => {
		expect(geometryCenter(null)).toBeNull();
	});
});
