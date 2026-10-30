import { describe, expect, it } from "vitest";
import {
	METERS_PER_DEGREE_LAT,
	PLAZA_CLEAR_RADIUS_M,
} from "../../src/map/objects/constants";
import { placeTileObjects } from "../../src/map/objects/tilePlacement";

const center = { lon: -76.38, lat: -11.84 };
const lonPerMeter = 1 / (111_320 * Math.cos((center.lat * Math.PI) / 180));
const latPerMeter = 1 / METERS_PER_DEGREE_LAT;

function square(lon: number, lat: number, sideMeters: number): [number, number][][] {
	const halfLon = (sideMeters / 2) * lonPerMeter;
	const halfLat = (sideMeters / 2) * latPerMeter;
	return [
		[
			[lon - halfLon, lat - halfLat],
			[lon + halfLon, lat - halfLat],
			[lon + halfLon, lat + halfLat],
			[lon - halfLon, lat + halfLat],
			[lon - halfLon, lat - halfLat],
		],
	];
}

const tileBox = { west: -76.39, south: -11.85, east: -76.37, north: -11.83 };
const sources = {
	blocks: [{ id: "15070100100011#0", rings: square(center.lon, center.lat, 200) }],
	places: [{ id: "1507010001", name: "MATUCANA", lon: center.lon, lat: center.lat }],
	landCover: [{ landCover: "Cardonal", rings: square(center.lon, center.lat, 1500) }],
};
const highland = () => 2400;

describe("placeTileObjects", () => {
	const objects = placeTileObjects("14/1/2", tileBox, sources, highland);
	const houses = objects.filter((object) => object.kind === "house");

	it("puts a plaza on each urban place and a church beside it", () => {
		const plazas = objects.filter((object) => object.model === "plaza");
		const churches = objects.filter((object) => object.model === "church");
		expect(plazas).toHaveLength(1);
		expect(churches).toHaveLength(1);
		expect(plazas[0].lon).toBeCloseTo(center.lon, 9);
		expect(churches[0].lon).toBeGreaterThan(center.lon);
	});

	it("leaves the plaza free of houses", () => {
		expect(houses.length).toBeGreaterThan(0);
		for (const house of houses) {
			const distanceMeters = Math.hypot(
				(house.lon - center.lon) / lonPerMeter,
				(house.lat - center.lat) / latPerMeter,
			);
			expect(distanceMeters).toBeGreaterThan(PLAZA_CLEAR_RADIUS_M);
		}
	});

	it("chooses highland house types from the block elevation", () => {
		for (const house of houses)
			expect(["adobeTile", "adobeTin", "brickTin"]).toContain(house.model);
	});

	it("keeps vegetation out of city blocks", () => {
		const plants = objects.filter((object) => object.kind === "plant");
		expect(plants.length).toBeGreaterThan(0);
		const block = sources.blocks[0].rings[0];
		for (const plant of plants)
			expect(
				plant.lon > block[0][0] &&
					plant.lon < block[1][0] &&
					plant.lat > block[0][1] &&
					plant.lat < block[2][1],
			).toBe(false);
	});

	it("only keeps objects inside the tile, so neighbouring tiles never duplicate them", () => {
		for (const object of objects) {
			expect(object.lon).toBeGreaterThanOrEqual(tileBox.west);
			expect(object.lon).toBeLessThan(tileBox.east);
			expect(object.lat).toBeGreaterThanOrEqual(tileBox.south);
			expect(object.lat).toBeLessThan(tileBox.north);
		}
	});

	it("is deterministic", () => {
		expect(placeTileObjects("14/1/2", tileBox, sources, highland)).toEqual(objects);
	});
});
