import {
	INCIDENT_SEVERITIES,
	type IncidentSeverity,
} from "@hack-the-andes-project/db/schema/scraper";
import { bbox } from "@turf/bbox";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { distance } from "@turf/distance";
import type { Geometry } from "geojson";

import type { LatLng } from "../hazards/types";
import { METERS_PER_DEGREE_LATITUDE } from "./constants";

export interface OfficialAlert {
	severity: IncidentSeverity;
	geometry: Geometry | null;
	lat: number | null;
	lng: number | null;
}

function distanceM(from: LatLng, to: LatLng): number {
	return distance([from.lng, from.lat], [to.lng, to.lat], { units: "meters" });
}

function cellKey(latCell: number, lngCell: number): string {
	return `${latCell}:${lngCell}`;
}

// Buckets events on a grid of radius-sized cells so each point only measures
// distances to events in its neighbouring cells (segments × history events is
// otherwise tens of millions of pairs per run).
export function countEventsNearby(
	points: LatLng[],
	events: LatLng[],
	radiusM: number,
): number[] {
	const cellDeg = radiusM / METERS_PER_DEGREE_LATITUDE;
	const buckets = new Map<string, LatLng[]>();
	for (const event of events) {
		const key = cellKey(
			Math.floor(event.lat / cellDeg),
			Math.floor(event.lng / cellDeg),
		);
		buckets.set(key, [...(buckets.get(key) ?? []), event]);
	}

	return points.map((point) => {
		const latCell = Math.floor(point.lat / cellDeg);
		const lngCell = Math.floor(point.lng / cellDeg);
		// A degree of longitude shrinks with latitude, so the radius spans more
		// longitude cells than latitude cells.
		const lngSpan = Math.ceil(1 / Math.cos((point.lat * Math.PI) / 180));
		let count = 0;
		for (let latOffset = -1; latOffset <= 1; latOffset += 1) {
			for (let lngOffset = -lngSpan; lngOffset <= lngSpan; lngOffset += 1) {
				for (const event of buckets.get(
					cellKey(latCell + latOffset, lngCell + lngOffset),
				) ?? []) {
					if (distanceM(point, event) <= radiusM) {
						count += 1;
					}
				}
			}
		}
		return count;
	});
}

// Area alerts (SENAMHI warning polygons) apply by containment; everything
// else (SUTRAN road alerts, INDECI emergencies) by distance to its location.
export function strongestOfficialAlert(
	point: LatLng,
	alerts: OfficialAlert[],
	radiusM: number,
): IncidentSeverity | null {
	let strongest: IncidentSeverity | null = null;
	for (const alert of alerts) {
		const applies =
			alert.geometry &&
			(alert.geometry.type === "Polygon" ||
				alert.geometry.type === "MultiPolygon")
				? isInsideBounds(point, alert.geometry) &&
					booleanPointInPolygon([point.lng, point.lat], alert.geometry)
				: alert.lat !== null &&
					alert.lng !== null &&
					distanceM(point, { lat: alert.lat, lng: alert.lng }) <= radiusM;
		if (
			applies &&
			(strongest === null ||
				INCIDENT_SEVERITIES.indexOf(alert.severity) >
					INCIDENT_SEVERITIES.indexOf(strongest))
		) {
			strongest = alert.severity;
		}
	}
	return strongest;
}

const boundsCache = new WeakMap<Geometry, number[]>();

function isInsideBounds(point: LatLng, geometry: Geometry): boolean {
	const bounds = boundsCache.get(geometry) ?? bbox(geometry);
	boundsCache.set(geometry, bounds);
	const [west = 0, south = 0, east = 0, north = 0] = bounds;
	return (
		point.lng >= west &&
		point.lng <= east &&
		point.lat >= south &&
		point.lat <= north
	);
}
