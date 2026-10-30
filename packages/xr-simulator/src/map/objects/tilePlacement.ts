import type { LonLatBox } from "../tileMath";
import {
	CHURCH_OFFSET_M,
	METERS_PER_DEGREE_LAT,
	METERS_PER_DEGREE_LON_AT_EQUATOR,
	PLAZA_CLEAR_RADIUS_M,
} from "./constants";
import {
	type HouseType,
	housesInBlock,
	isInsidePolygon,
	type LandCoverArea,
	regionForElevation,
	ringBounds,
	type VegetationModel,
	vegetationInTile,
} from "./placement";
import type { CityBlock, PopulatedPlace } from "./sources";

export interface TileSources {
	blocks: CityBlock[];
	places: PopulatedPlace[];
	landCover: LandCoverArea[];
}

export type PlacedObject =
	| {
			kind: "house";
			model: HouseType;
			lon: number;
			lat: number;
			heading: number;
			variant: number;
	  }
	| {
			kind: "plant";
			model: VegetationModel;
			lon: number;
			lat: number;
			heading: number;
			variant: number;
	  }
	| {
			kind: "landmark";
			model: "plaza" | "church";
			lon: number;
			lat: number;
			heading: number;
			variant: number;
	  };

function isInsideTile(box: LonLatBox, lon: number, lat: number): boolean {
	return (
		lon >= box.west && lon < box.east && lat >= box.south && lat < box.north
	);
}

/**
 * Every object of one tile: houses in its city blocks (none around a town's plaza), a plaza
 * and church per urban place, and vegetation outside the blocks. Sources cover features that
 * merely intersect the tile, so only objects standing inside it are kept.
 */
export function placeTileObjects(
	tileKey: string,
	box: LonLatBox,
	sources: TileSources,
	elevationAt: (lon: number, lat: number) => number,
): PlacedObject[] {
	const lonPerMeter =
		1 /
		(METERS_PER_DEGREE_LON_AT_EQUATOR *
			Math.cos((((box.south + box.north) / 2) * Math.PI) / 180));
	const latPerMeter = 1 / METERS_PER_DEGREE_LAT;
	const isNearPlaza = (lon: number, lat: number) =>
		sources.places.some(
			(place) =>
				Math.hypot(
					(lon - place.lon) / lonPerMeter,
					(lat - place.lat) / latPerMeter,
				) <= PLAZA_CLEAR_RADIUS_M,
		);
	const objects: PlacedObject[] = [];
	for (const place of sources.places) {
		const churchLon = place.lon + CHURCH_OFFSET_M * lonPerMeter;
		if (isInsideTile(box, place.lon, place.lat))
			objects.push({
				kind: "landmark",
				model: "plaza",
				lon: place.lon,
				lat: place.lat,
				heading: 0,
				variant: 0,
			});
		if (isInsideTile(box, churchLon, place.lat))
			objects.push({
				kind: "landmark",
				model: "church",
				lon: churchLon,
				lat: place.lat,
				heading: Math.PI / 2,
				variant: 0,
			});
	}
	for (const block of sources.blocks) {
		const [firstLon, firstLat] = block.rings[0][0];
		const region = regionForElevation(elevationAt(firstLon, firstLat));
		for (const house of housesInBlock(block.id, block.rings, region))
			if (
				isInsideTile(box, house.lon, house.lat) &&
				!isNearPlaza(house.lon, house.lat)
			)
				objects.push({
					kind: "house",
					model: house.type,
					lon: house.lon,
					lat: house.lat,
					heading: house.heading,
					variant: house.variant,
				});
	}
	const blockAreas = sources.blocks.map((block) => ({
		rings: block.rings,
		bounds: ringBounds(block.rings[0]),
	}));
	const isInsideBlock = (lon: number, lat: number) =>
		blockAreas.some(
			(block) =>
				lon >= block.bounds.west &&
				lon <= block.bounds.east &&
				lat >= block.bounds.south &&
				lat <= block.bounds.north &&
				isInsidePolygon([lon, lat], block.rings),
		);
	for (const plant of vegetationInTile(
		tileKey,
		box,
		sources.landCover,
		elevationAt,
	))
		if (
			!isNearPlaza(plant.lon, plant.lat) &&
			!isInsideBlock(plant.lon, plant.lat)
		)
			objects.push({ kind: "plant", ...plant });
	return objects;
}
