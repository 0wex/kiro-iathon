import type {
	IncidentCategory,
	IncidentSeverity,
} from "@hack-the-andes-project/db/schema/scraper";
import type { Geometry, LineString } from "geojson";

export interface LatLng {
	lat: number;
	lng: number;
}

export interface RouteCandidate {
	geometry: LineString;
	distanceM: number;
	durationS: number;
}

export interface VehicleState {
	position: LatLng;
	speedKmh: number | null;
	heading: number | null;
	recordedAt: Date;
}

export interface HazardIncident {
	id: string;
	category: IncidentCategory;
	severity: IncidentSeverity;
	title: string;
	geometry: Geometry | null;
	lat: number | null;
	lng: number | null;
}

export interface HazardAhead {
	incident: HazardIncident;
	distanceAheadM: number;
	etaSeconds: number | null;
	severity: IncidentSeverity;
}

export interface RouteProgress {
	distanceAlongM: number;
	offRouteM: number;
	remainingDistanceM: number;
}
