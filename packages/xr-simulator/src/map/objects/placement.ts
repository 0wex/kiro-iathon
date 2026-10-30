import type { LonLatBox } from "../tileMath";
import {
	COAST_MAX_ELEVATION_M,
	HOUSE_JITTER_M,
	HOUSE_SPACING_M,
	METERS_PER_DEGREE_LAT,
	METERS_PER_DEGREE_LON_AT_EQUATOR,
	PUNA_MIN_ELEVATION_M,
	VEGETATION_CELL_M,
	VEGETATION_JITTER_RATIO,
	VEGETATION_ROW_STRIPS,
} from "./constants";

/** [lon, lat] rings of one polygon: the outer ring first, then its holes. */
export type PolygonRings = [number, number][][];

export type Region = "costa" | "sierra";

export type HouseType =
	| "coastFlatRoof"
	| "coastUnfinished"
	| "coastApartment"
	| "coastMatting"
	| "adobeTile"
	| "adobeTin"
	| "brickTin";

export type VegetationModel =
	| "ichu"
	| "tola"
	| "queuna"
	| "eucalyptus"
	| "cactus"
	| "thornShrub";

export interface PlacedHouse {
	type: HouseType;
	lon: number;
	lat: number;
	/** Rotation about the vertical axis, radians from east towards north. */
	heading: number;
	/** 0..1 draw used by the model for size and colour variants. */
	variant: number;
}

export interface PlacedPlant {
	model: VegetationModel;
	lon: number;
	lat: number;
	heading: number;
	variant: number;
}

export interface LandCoverArea {
	landCover: string;
	rings: PolygonRings;
}

interface WeightedHouse {
	type: HouseType;
	weight: number;
}

interface VegetationRule {
	model: VegetationModel;
	plantsPerHectare: number;
}

/**
 * Region house mix while the census housing material is not integrated: the only
 * rule to replace when block-level wall material data becomes available.
 */
export const HOUSE_TYPES_BY_REGION: Record<Region, WeightedHouse[]> = {
	costa: [
		{ type: "coastFlatRoof", weight: 0.4 },
		{ type: "coastUnfinished", weight: 0.38 },
		{ type: "coastApartment", weight: 0.1 },
		{ type: "coastMatting", weight: 0.12 },
	],
	sierra: [
		{ type: "adobeTile", weight: 0.3 },
		{ type: "adobeTin", weight: 0.4 },
		{ type: "brickTin", weight: 0.3 },
	],
};

const ANDEAN_GRASSLAND: VegetationRule[] = [
	{ model: "ichu", plantsPerHectare: 18 },
	{ model: "tola", plantsPerHectare: 2 },
];
const DRY_SCRUB: VegetationRule[] = [
	{ model: "thornShrub", plantsPerHectare: 10 },
	{ model: "cactus", plantsPerHectare: 3 },
];
const HIGHLAND_RELICT_FOREST: VegetationRule[] = [
	{ model: "queuna", plantsPerHectare: 20 },
	{ model: "ichu", plantsPerHectare: 4 },
];

/** MINAM Cobertura Vegetal (`CobVeg2013`) classes that have phase-1 models. */
const VEGETATION_BY_LAND_COVER: Record<string, VegetationRule[]> = {
	"Pajonal andino": ANDEAN_GRASSLAND,
	Jalca: ANDEAN_GRASSLAND,
	Páramo: ANDEAN_GRASSLAND,
	"Matorral arbustivo": [
		{ model: "thornShrub", plantsPerHectare: 12 },
		{ model: "cactus", plantsPerHectare: 1 },
	],
	"Matorral arbustivo altimontano": [
		{ model: "thornShrub", plantsPerHectare: 12 },
	],
	"Matorral esclerófilo de montaña montano": [
		{ model: "thornShrub", plantsPerHectare: 14 },
	],
	Cardonal: [
		{ model: "cactus", plantsPerHectare: 8 },
		{ model: "thornShrub", plantsPerHectare: 4 },
	],
	"Bosque xérico interandino": DRY_SCRUB,
	"Sabana xérica interandina": DRY_SCRUB,
	Loma: [{ model: "thornShrub", plantsPerHectare: 5 }],
	"Bosque relicto altoandino": HIGHLAND_RELICT_FOREST,
	"Bosque relicto mesoandino": HIGHLAND_RELICT_FOREST,
	"Bosque relicto mesoandino de coníferas": HIGHLAND_RELICT_FOREST,
	"Plantación Forestal": [{ model: "eucalyptus", plantsPerHectare: 22 }],
	"Agricultura costera y andina": [
		{ model: "eucalyptus", plantsPerHectare: 2 },
	],
};

/** FNV-1a 32-bit hash: a stable seed from a block id or tile key. */
export function hashText(text: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** Mulberry32: small, fast seeded generator with values in [0, 1). */
export function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
}

/** Even-odd test over every ring, so points inside a hole are outside. */
export function isInsidePolygon(
	[lon, lat]: [number, number],
	rings: PolygonRings,
): boolean {
	let inside = false;
	for (const ring of rings)
		for (
			let index = 0, previous = ring.length - 1;
			index < ring.length;
			previous = index++
		) {
			const [lonA, latA] = ring[index];
			const [lonB, latB] = ring[previous];
			if (
				latA > lat !== latB > lat &&
				lon < ((lonB - lonA) * (lat - latA)) / (latB - latA) + lonA
			)
				inside = !inside;
		}
	return inside;
}

export function regionForElevation(elevationMeters: number): Region {
	return elevationMeters < COAST_MAX_ELEVATION_M ? "costa" : "sierra";
}

export function chooseHouseType(
	region: Region,
	random: () => number,
): HouseType {
	const options = HOUSE_TYPES_BY_REGION[region];
	const total = options.reduce((sum, option) => sum + option.weight, 0);
	let draw = random() * total;
	for (const option of options) {
		draw -= option.weight;
		if (draw < 0) return option.type;
	}
	return options[options.length - 1].type;
}

function metersPerDegreeLon(lat: number): number {
	return METERS_PER_DEGREE_LON_AT_EQUATOR * Math.cos((lat * Math.PI) / 180);
}

/** Direction of the block's longest outer edge, radians from east towards north. */
export function blockHeading(rings: PolygonRings): number {
	const outer = rings[0];
	const lonScale = metersPerDegreeLon(outer[0][1]);
	let longest = 0;
	let heading = 0;
	for (let index = 1; index < outer.length; index++) {
		const east = (outer[index][0] - outer[index - 1][0]) * lonScale;
		const north =
			(outer[index][1] - outer[index - 1][1]) * METERS_PER_DEGREE_LAT;
		const length = Math.hypot(east, north);
		if (length > longest) {
			longest = length;
			heading = Math.atan2(north, east);
		}
	}
	return heading;
}

export function ringBounds(ring: [number, number][]): LonLatBox {
	const box = {
		west: Number.POSITIVE_INFINITY,
		south: Number.POSITIVE_INFINITY,
		east: Number.NEGATIVE_INFINITY,
		north: Number.NEGATIVE_INFINITY,
	};
	for (const [lon, lat] of ring) {
		box.west = Math.min(box.west, lon);
		box.east = Math.max(box.east, lon);
		box.south = Math.min(box.south, lat);
		box.north = Math.max(box.north, lat);
	}
	return box;
}

/**
 * Houses on a grid aligned with the block's longest edge, kept where the slot lies
 * inside the block. Seeded by the block id, so a block always gets the same houses.
 */
export function housesInBlock(
	blockId: string,
	rings: PolygonRings,
	region: Region,
): PlacedHouse[] {
	const random = createRandom(hashText(blockId));
	const heading = blockHeading(rings);
	const bounds = ringBounds(rings[0]);
	const centerLon = (bounds.west + bounds.east) / 2;
	const centerLat = (bounds.south + bounds.north) / 2;
	const lonScale = metersPerDegreeLon(centerLat);
	const halfDiagonal =
		Math.hypot(
			(bounds.east - bounds.west) * lonScale,
			(bounds.north - bounds.south) * METERS_PER_DEGREE_LAT,
		) / 2;
	const cos = Math.cos(heading);
	const sin = Math.sin(heading);
	const houses: PlacedHouse[] = [];
	for (
		let along = -halfDiagonal;
		along <= halfDiagonal;
		along += HOUSE_SPACING_M
	)
		for (
			let across = -halfDiagonal;
			across <= halfDiagonal;
			across += HOUSE_SPACING_M
		) {
			const jitterAlong = (random() - 0.5) * 2 * HOUSE_JITTER_M;
			const jitterAcross = (random() - 0.5) * 2 * HOUSE_JITTER_M;
			const east = (along + jitterAlong) * cos - (across + jitterAcross) * sin;
			const north = (along + jitterAlong) * sin + (across + jitterAcross) * cos;
			const lon = centerLon + east / lonScale;
			const lat = centerLat + north / METERS_PER_DEGREE_LAT;
			const type = chooseHouseType(region, random);
			const variant = random();
			if (isInsidePolygon([lon, lat], rings))
				houses.push({ type, lon, lat, heading, variant });
		}
	return houses;
}

export function vegetationRuleFor(
	landCover: string,
	elevationMeters: number,
): VegetationRule[] {
	const rules = VEGETATION_BY_LAND_COVER[landCover] ?? [];
	if (elevationMeters < PUNA_MIN_ELEVATION_M) return rules;
	return rules.map((rule) =>
		rule.model === "thornShrub" ? { ...rule, model: "tola" } : rule,
	);
}

/** Sorted longitudes where the polygon's edges cross `lat` (same half-open rule as isInsidePolygon). */
function crossingsAt(rings: PolygonRings, lat: number): number[] {
	const crossings: number[] = [];
	for (const ring of rings)
		for (
			let index = 0, previous = ring.length - 1;
			index < ring.length;
			previous = index++
		) {
			const [lonA, latA] = ring[index];
			const [lonB, latB] = ring[previous];
			if (latA > lat !== latB > lat)
				crossings.push(((lonB - lonA) * (lat - latA)) / (latB - latA) + lonA);
		}
	return crossings.sort((first, second) => first - second);
}

/**
 * At most one plant per sampling cell of the tile: the cell's land cover and elevation decide
 * which model can grow there and how likely it is. Each row of cells is split in latitude
 * strips whose edge crossings are computed once, because land-cover polygons cover the whole
 * tile with tens of thousands of vertices and a point-in-polygon test per cell is too slow.
 */
export function vegetationInTile(
	tileKey: string,
	tileBox: LonLatBox,
	areas: LandCoverArea[],
	elevationAt: (lon: number, lat: number) => number,
): PlacedPlant[] {
	const random = createRandom(hashText(tileKey));
	const centerLat = (tileBox.south + tileBox.north) / 2;
	const cellLon = VEGETATION_CELL_M / metersPerDegreeLon(centerLat);
	const cellLat = VEGETATION_CELL_M / METERS_PER_DEGREE_LAT;
	const cellHectares = (VEGETATION_CELL_M * VEGETATION_CELL_M) / 10_000;
	const usefulAreas = areas
		.filter((area) => vegetationRuleFor(area.landCover, 0).length > 0)
		.map((area) => ({ ...area, bounds: ringBounds(area.rings[0]) }));
	const plants: PlacedPlant[] = [];
	if (usefulAreas.length === 0) return plants;
	for (let rowLat = tileBox.south; rowLat < tileBox.north; rowLat += cellLat) {
		const strips = Array.from({ length: VEGETATION_ROW_STRIPS }, (_, strip) => {
			const lat = rowLat + (cellLat * (strip + 0.5)) / VEGETATION_ROW_STRIPS;
			return {
				lat,
				crossings: usefulAreas.map((area) =>
					lat >= area.bounds.south && lat <= area.bounds.north
						? crossingsAt(area.rings, lat)
						: [],
				),
			};
		});
		for (let lon = tileBox.west; lon < tileBox.east; lon += cellLon) {
			const draw = random();
			const strip = strips[Math.floor(random() * VEGETATION_ROW_STRIPS)];
			const plantLon =
				lon + cellLon * (0.5 + (random() - 0.5) * VEGETATION_JITTER_RATIO);
			const heading = random() * Math.PI * 2;
			const variant = random();
			const areaIndex = strip.crossings.findIndex(
				(crossings) =>
					crossings.filter((crossing) => crossing < plantLon).length % 2 === 1,
			);
			if (areaIndex < 0) continue;
			let threshold = 0;
			for (const rule of vegetationRuleFor(
				usefulAreas[areaIndex].landCover,
				elevationAt(plantLon, strip.lat),
			)) {
				threshold += rule.plantsPerHectare * cellHectares;
				if (draw < threshold) {
					plants.push({
						model: rule.model,
						lon: plantLon,
						lat: strip.lat,
						heading,
						variant,
					});
					break;
				}
			}
		}
	}
	return plants;
}
