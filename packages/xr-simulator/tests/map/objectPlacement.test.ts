import { describe, expect, it } from "vitest";
import {
	blockHeading,
	chooseHouseType,
	createRandom,
	HOUSE_TYPES_BY_REGION,
	hashText,
	housesInBlock,
	isInsidePolygon,
	type PolygonRings,
	regionForElevation,
	vegetationInTile,
	vegetationRuleFor,
} from "../../src/map/objects/placement";

const METERS_PER_DEGREE_LAT = 110_540;

/** Square block of `sideMeters` centred on (lon, lat), as a closed lon/lat ring. */
function squareBlock(
	lon: number,
	lat: number,
	sideMeters: number,
): PolygonRings {
	const halfLat = sideMeters / 2 / METERS_PER_DEGREE_LAT;
	const halfLon = sideMeters / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
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

describe("createRandom", () => {
	it("repeats the same sequence for the same seed and stays in [0, 1)", () => {
		const first = createRandom(hashText("15070100100011"));
		const second = createRandom(hashText("15070100100011"));
		const values = Array.from({ length: 50 }, () => first());
		expect(values).toEqual(Array.from({ length: 50 }, () => second()));
		for (const value of values) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
	it("gives different sequences for different seeds", () => {
		expect(createRandom(hashText("a"))()).not.toBe(
			createRandom(hashText("b"))(),
		);
	});
});

describe("isInsidePolygon", () => {
	const outer: [number, number][] = [
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10],
		[0, 0],
	];
	const hole: [number, number][] = [
		[4, 4],
		[6, 4],
		[6, 6],
		[4, 6],
		[4, 4],
	];
	it("accepts points inside the outer ring and rejects points outside", () => {
		expect(isInsidePolygon([5, 2], [outer])).toBe(true);
		expect(isInsidePolygon([11, 5], [outer])).toBe(false);
	});
	it("rejects points inside a hole", () => {
		expect(isInsidePolygon([5, 5], [outer, hole])).toBe(false);
		expect(isInsidePolygon([2, 2], [outer, hole])).toBe(true);
	});
});

describe("regionForElevation", () => {
	it("splits the Carretera Central into coast and highland by elevation", () => {
		expect(regionForElevation(150)).toBe("costa");
		expect(regionForElevation(860)).toBe("costa");
		expect(regionForElevation(2400)).toBe("sierra");
		expect(regionForElevation(3700)).toBe("sierra");
	});
});

describe("chooseHouseType", () => {
	it("only returns house types of the block's region", () => {
		const random = createRandom(1);
		for (let draw = 0; draw < 200; draw++) {
			expect(HOUSE_TYPES_BY_REGION.costa.map((entry) => entry.type)).toContain(
				chooseHouseType("costa", random),
			);
			expect(HOUSE_TYPES_BY_REGION.sierra.map((entry) => entry.type)).toContain(
				chooseHouseType("sierra", random),
			);
		}
	});
	it("uses every type of a region over many draws", () => {
		const random = createRandom(7);
		const seen = new Set(
			Array.from({ length: 2000 }, () => chooseHouseType("sierra", random)),
		);
		expect(seen.size).toBe(HOUSE_TYPES_BY_REGION.sierra.length);
	});
});

describe("blockHeading", () => {
	it("follows the longest edge of the block", () => {
		const eastWest = squareBlock(-76.38, -11.84, 40)[0].map(
			([lon, lat]) => [lon + (lon + 76.38) * 2, lat] as [number, number],
		);
		expect(Math.abs(Math.sin(blockHeading([eastWest])))).toBeCloseTo(0, 3);
	});
});

describe("housesInBlock", () => {
	const block = squareBlock(-76.38, -11.84, 60);
	const houses = housesInBlock("15070100100011", block, "sierra");

	it("places houses only inside the block", () => {
		expect(houses.length).toBeGreaterThan(0);
		for (const house of houses)
			expect(isInsidePolygon([house.lon, house.lat], block)).toBe(true);
	});
	it("is deterministic for the same block id", () => {
		expect(housesInBlock("15070100100011", block, "sierra")).toEqual(houses);
	});
	it("uses only types of the given region", () => {
		const sierraTypes = HOUSE_TYPES_BY_REGION.sierra.map((entry) => entry.type);
		for (const house of houses) expect(sierraTypes).toContain(house.type);
	});
	it("places nothing in a block too small for a house", () => {
		expect(
			housesInBlock("tiny", squareBlock(-76.38, -11.84, 3), "costa"),
		).toEqual([]);
	});
});

describe("vegetationRuleFor", () => {
	it("maps MINAM land-cover classes to phase-1 models", () => {
		expect(
			vegetationRuleFor("Cardonal", 1500).map((rule) => rule.model),
		).toContain("cactus");
		expect(
			vegetationRuleFor("Pajonal andino", 4200).map((rule) => rule.model),
		).toContain("ichu");
		expect(
			vegetationRuleFor("Bosque relicto altoandino", 4000).map(
				(rule) => rule.model,
			),
		).toContain("queuna");
		expect(
			vegetationRuleFor("Plantación Forestal", 3200).map((rule) => rule.model),
		).toContain("eucalyptus");
	});
	it("swaps the thorny shrub for tola above the puna line", () => {
		const low = vegetationRuleFor("Matorral arbustivo", 2500).map(
			(rule) => rule.model,
		);
		const high = vegetationRuleFor("Matorral arbustivo", 4000).map(
			(rule) => rule.model,
		);
		expect(low).toContain("thornShrub");
		expect(high).toContain("tola");
		expect(high).not.toContain("thornShrub");
	});
	it("places nothing on classes without vegetation models", () => {
		for (const landCover of [
			"Glaciar",
			"Lagunas, lagos y cochas",
			"Desierto costero",
			"Area altoandina con escasa y sin vegetación",
			"Clase desconocida",
		])
			expect(vegetationRuleFor(landCover, 3000)).toEqual([]);
	});
});

describe("vegetationInTile", () => {
	const tileBox = { west: -76.4, south: -11.86, east: -76.39, north: -11.85 };
	const cardonal = {
		landCover: "Cardonal",
		rings: [
			[
				[-76.4, -11.86],
				[-76.395, -11.86],
				[-76.395, -11.85],
				[-76.4, -11.85],
				[-76.4, -11.86],
			],
		] as PolygonRings,
	};
	const flat = () => 1500;

	it("places plants only inside land-cover polygons that have models", () => {
		const plants = vegetationInTile("14/1234/5678", tileBox, [cardonal], flat);
		expect(plants.length).toBeGreaterThan(0);
		for (const plant of plants) {
			expect(isInsidePolygon([plant.lon, plant.lat], cardonal.rings)).toBe(
				true,
			);
			expect(["cactus", "thornShrub"]).toContain(plant.model);
		}
	});
	it("is deterministic for the same tile key", () => {
		expect(vegetationInTile("14/1234/5678", tileBox, [cardonal], flat)).toEqual(
			vegetationInTile("14/1234/5678", tileBox, [cardonal], flat),
		);
	});
	it("places nothing inside a hole of a land-cover polygon", () => {
		const hole: [number, number][] = [
			[-76.399, -11.859],
			[-76.396, -11.859],
			[-76.396, -11.851],
			[-76.399, -11.851],
			[-76.399, -11.859],
		];
		const withHole = { ...cardonal, rings: [...cardonal.rings, hole] };
		const plants = vegetationInTile("14/1234/5678", tileBox, [withHole], flat);
		expect(plants.length).toBeGreaterThan(0);
		for (const plant of plants)
			expect(isInsidePolygon([plant.lon, plant.lat], [hole])).toBe(false);
	});
	it("places nothing where the land cover has no models", () => {
		expect(
			vegetationInTile(
				"14/1234/5678",
				tileBox,
				[{ ...cardonal, landCover: "Glaciar" }],
				flat,
			),
		).toEqual([]);
	});
});
