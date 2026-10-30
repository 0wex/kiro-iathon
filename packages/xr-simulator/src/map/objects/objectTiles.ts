import { lonLatToTile, type TileId, tileBoundsLonLat } from "../tileMath";
import {
	METERS_PER_DEGREE_LAT,
	METERS_PER_DEGREE_LON_AT_EQUATOR,
	OBJECT_TILE_ZOOM,
	OBJECTS_LOAD_RADIUS_KM,
	OBJECTS_MAX_VIEW_KM,
} from "./constants";

export function objectTileKey(tile: TileId): string {
	return `${tile.z}/${tile.x}/${tile.y}`;
}

/**
 * Object tiles whose footprint reaches within the load radius of the focus, nearest first;
 * none while the camera is farther than OBJECTS_MAX_VIEW_KM from what it looks at.
 */
export function objectTilesAround(
	focus: { lon: number; lat: number },
	viewKm: number,
): TileId[] {
	if (viewKm > OBJECTS_MAX_VIEW_KM) return [];
	const kmPerDegreeLat = METERS_PER_DEGREE_LAT / 1000;
	const kmPerDegreeLon =
		(METERS_PER_DEGREE_LON_AT_EQUATOR / 1000) * Math.cos((focus.lat * Math.PI) / 180);
	const radiusLat = OBJECTS_LOAD_RADIUS_KM / kmPerDegreeLat;
	const radiusLon = OBJECTS_LOAD_RADIUS_KM / kmPerDegreeLon;
	const northWest = lonLatToTile(focus.lon - radiusLon, focus.lat + radiusLat, OBJECT_TILE_ZOOM);
	const southEast = lonLatToTile(focus.lon + radiusLon, focus.lat - radiusLat, OBJECT_TILE_ZOOM);
	const candidates: { tile: TileId; distanceKm: number }[] = [];
	for (let y = northWest.y; y <= southEast.y; y++)
		for (let x = northWest.x; x <= southEast.x; x++) {
			const tile = { z: OBJECT_TILE_ZOOM, x, y };
			const box = tileBoundsLonLat(tile);
			const nearestLon = Math.min(Math.max(focus.lon, box.west), box.east);
			const nearestLat = Math.min(Math.max(focus.lat, box.south), box.north);
			const distanceKm = Math.hypot(
				(nearestLon - focus.lon) * kmPerDegreeLon,
				(nearestLat - focus.lat) * kmPerDegreeLat,
			);
			if (distanceKm <= OBJECTS_LOAD_RADIUS_KM) candidates.push({ tile, distanceKm });
		}
	return candidates
		.sort((first, second) => first.distanceKm - second.distanceKm)
		.map((candidate) => candidate.tile);
}
