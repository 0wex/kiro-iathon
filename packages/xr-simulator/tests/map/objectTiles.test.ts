import { describe, expect, it } from "vitest";
import {
	OBJECT_TILE_ZOOM,
	OBJECTS_LOAD_RADIUS_KM,
	OBJECTS_MAX_VIEW_KM,
} from "../../src/map/objects/constants";
import { objectTilesAround } from "../../src/map/objects/objectTiles";
import { lonLatToTile, tileBoundsLonLat } from "../../src/map/tileMath";

const matucana = { lon: -76.38, lat: -11.84 };

describe("objectTilesAround", () => {
	it("asks for nothing while the camera is far from the ground", () => {
		expect(objectTilesAround(matucana, OBJECTS_MAX_VIEW_KM + 1)).toEqual([]);
	});

	it("starts with the tile under the focus, at the object zoom", () => {
		const tiles = objectTilesAround(matucana, 1);
		expect(tiles[0]).toEqual(lonLatToTile(matucana.lon, matucana.lat, OBJECT_TILE_ZOOM));
		for (const tile of tiles) expect(tile.z).toBe(OBJECT_TILE_ZOOM);
	});

	it("only includes tiles reaching into the load radius, without repeats", () => {
		const tiles = objectTilesAround(matucana, 1);
		const keys = tiles.map((tile) => `${tile.x}/${tile.y}`);
		expect(new Set(keys).size).toBe(keys.length);
		const kmPerDegreeLat = 110.54;
		for (const tile of tiles) {
			const box = tileBoundsLonLat(tile);
			const nearestLat = Math.min(Math.max(matucana.lat, box.south), box.north);
			const nearestLon = Math.min(Math.max(matucana.lon, box.west), box.east);
			const distanceKm = Math.hypot(
				(nearestLat - matucana.lat) * kmPerDegreeLat,
				(nearestLon - matucana.lon) *
					111.32 *
					Math.cos((matucana.lat * Math.PI) / 180),
			);
			expect(distanceKm).toBeLessThanOrEqual(OBJECTS_LOAD_RADIUS_KM);
		}
		expect(tiles.length).toBeGreaterThan(4);
	});
});
