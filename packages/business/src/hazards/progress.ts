import { length } from "@turf/length";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import type { LineString } from "geojson";

import type { LatLng, RouteProgress } from "./types";

export function projectOntoRoute(
	route: LineString,
	position: LatLng,
): RouteProgress {
	const snapped = nearestPointOnLine(route, [position.lng, position.lat], {
		units: "meters",
	});
	const routeLengthM = length(
		{ type: "Feature", geometry: route, properties: {} },
		{ units: "meters" },
	);
	const distanceAlongM = Math.min(
		snapped.properties.totalDistance,
		routeLengthM,
	);
	return {
		distanceAlongM,
		offRouteM: snapped.properties.pointDistance,
		remainingDistanceM: routeLengthM - distanceAlongM,
	};
}
