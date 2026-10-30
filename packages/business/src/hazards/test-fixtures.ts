import type { LineString } from "geojson";

import type { HazardIncident, RouteCandidate, VehicleState } from "./types";

export const LIMA: [number, number] = [-76.88, -12.05];
export const CHOSICA: [number, number] = [-76.7, -11.94];
export const MATUCANA: [number, number] = [-76.4, -11.84];
export const SAN_MATEO: [number, number] = [-76.3, -11.76];
export const CASAPALCA: [number, number] = [-76.23, -11.68];
export const TICLIO: [number, number] = [-76.18, -11.6];
export const LA_OROYA: [number, number] = [-75.9, -11.52];
export const JAUJA: [number, number] = [-75.5, -11.78];
export const CONCEPCION: [number, number] = [-75.31, -11.92];
export const HUANCAYO: [number, number] = [-75.21, -12.07];

export const CARRETERA_CENTRAL: LineString = {
	type: "LineString",
	coordinates: [
		LIMA,
		CHOSICA,
		MATUCANA,
		SAN_MATEO,
		CASAPALCA,
		TICLIO,
		LA_OROYA,
		JAUJA,
		CONCEPCION,
		HUANCAYO,
	],
};

export const LIMA_HUANCAYO_ROUTE: RouteCandidate = {
	geometry: CARRETERA_CENTRAL,
	distanceM: 300_000,
	durationS: 7 * 3600,
};

export function vehicleAt(
	[lng, lat]: [number, number],
	speedKmh: number | null = 60,
): VehicleState {
	return {
		position: { lat, lng },
		speedKmh,
		heading: 90,
		recordedAt: new Date("2026-10-17T12:00:00Z"),
	};
}

export function pointIncident(
	id: string,
	[lng, lat]: [number, number],
	overrides: Partial<HazardIncident> = {},
): HazardIncident {
	return {
		id,
		category: "landslide",
		severity: "warning",
		title: `Incident ${id}`,
		geometry: { type: "Point", coordinates: [lng, lat] },
		lat,
		lng,
		...overrides,
	};
}
