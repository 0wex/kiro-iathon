import { bbox } from "@turf/bbox";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { buffer } from "@turf/buffer";
import { lineIntersect } from "@turf/line-intersect";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import type { BBox, Geometry, LineString, Position } from "geojson";

import type { HazardIncident } from "./types";

export function incidentGeometry(incident: HazardIncident): Geometry | null {
	if (incident.geometry) return incident.geometry;
	if (incident.lat !== null && incident.lng !== null) {
		return { type: "Point", coordinates: [incident.lng, incident.lat] };
	}
	return null;
}

export interface HazardRouteStart {
	distanceAlongM: number;
	coordinates: Position;
}

function nearestAlongDistanceM(
	route: LineString,
	points: Position[],
	bufferM: number,
	start?: HazardRouteStart,
): number | null {
	let closest: number | null = null;
	for (const coordinates of points) {
		const snapped = nearestPointOnLine(route, coordinates, { units: "meters" });
		if (snapped.properties.pointDistance > bufferM) continue;
		const alongM = snapped.properties.totalDistance;
		if (alongM < (start?.distanceAlongM ?? 0)) continue;
		if (closest === null || alongM < closest) closest = alongM;
	}
	return closest;
}

export function routeHazardBounds(route: LineString, bufferM: number): BBox {
	const corridor = buffer(route, bufferM, { units: "meters" });
	return bbox(corridor ?? route);
}

export function routeDistanceToHazardM(
	route: LineString,
	hazard: Geometry,
	bufferM: number,
	start?: HazardRouteStart,
	bounds?: BBox,
): number | null {
	if (bounds) {
		const hazardBounds = bbox(hazard);
		if (
			hazardBounds[0] > bounds[2] ||
			hazardBounds[2] < bounds[0] ||
			hazardBounds[1] > bounds[3] ||
			hazardBounds[3] < bounds[1]
		)
			return null;
	}
	switch (hazard.type) {
		case "Point":
			return nearestAlongDistanceM(route, [hazard.coordinates], bufferM, start);
		case "MultiPoint":
			return nearestAlongDistanceM(route, hazard.coordinates, bufferM, start);
		case "GeometryCollection": {
			let closest: number | null = null;
			for (const member of hazard.geometries) {
				const alongM = routeDistanceToHazardM(
					route,
					member,
					bufferM,
					start,
					bounds,
				);
				if (alongM !== null && (closest === null || alongM < closest)) {
					closest = alongM;
				}
			}
			return closest;
		}
		default: {
			// Buffering the hazard by the tolerance and then looking for where the
			// route enters that area handles both a route that crosses a polygon
			// edge and one that only passes nearby, with a single Turf operation.
			const zone = buffer(hazard, bufferM, { units: "meters" });
			if (!zone) return null;
			const routeStart = start?.coordinates ?? route.coordinates[0];
			if (routeStart && booleanPointInPolygon(routeStart, zone))
				return start?.distanceAlongM ?? 0;
			const crossings = lineIntersect(route, zone).features.map(
				(crossing) => crossing.geometry.coordinates,
			);
			return nearestAlongDistanceM(route, crossings, bufferM, start);
		}
	}
}
