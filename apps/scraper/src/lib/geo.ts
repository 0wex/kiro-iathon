import centroid from "@turf/centroid";
import { point } from "@turf/helpers";
import type { Geometry, Point } from "geojson";

export interface LatLng {
	lat: number;
	lng: number;
}

export function geometryCenter(
	geometry: Geometry | null | undefined,
): LatLng | null {
	if (!geometry) {
		return null;
	}
	try {
		const [lng, lat] = centroid(geometry).geometry.coordinates;
		return lng !== undefined && lat !== undefined ? { lat, lng } : null;
	} catch {
		return null;
	}
}

export function pointGeometry(location: LatLng): Point {
	return point([location.lng, location.lat]).geometry;
}

export function isPlausibleLatLng(location: LatLng): boolean {
	return (
		Number.isFinite(location.lat) &&
		Number.isFinite(location.lng) &&
		!(location.lat === 0 && location.lng === 0)
	);
}
