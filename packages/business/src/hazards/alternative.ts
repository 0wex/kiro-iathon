import { ALTERNATIVE_MAX_DETOUR_RATIO, HAZARD_BUFFER_M } from "../constants";
import { isAlertableIncident } from "./alertable";
import {
	incidentGeometry,
	routeDistanceToHazardM,
	routeHazardBounds,
} from "./route-distance";
import type { HazardIncident, RouteCandidate } from "./types";

export interface ChooseAlternativeRouteInput {
	candidates: RouteCandidate[];
	incidents: HazardIncident[];
	originalDurationS: number;
	bufferM?: number;
}

export function chooseAlternativeRoute({
	candidates,
	incidents,
	originalDurationS,
	bufferM = HAZARD_BUFFER_M,
}: ChooseAlternativeRouteInput): RouteCandidate | null {
	const hazardGeometries = incidents
		.filter(isAlertableIncident)
		.map(incidentGeometry)
		.filter((geometry) => geometry !== null);
	const maxDurationS = originalDurationS * ALTERNATIVE_MAX_DETOUR_RATIO;
	let best: RouteCandidate | null = null;
	for (const candidate of candidates) {
		if (candidate.durationS > maxDurationS) continue;
		if (best && candidate.durationS >= best.durationS) continue;
		const bounds = hazardGeometries.length
			? routeHazardBounds(candidate.geometry, bufferM)
			: undefined;
		const hazardous = hazardGeometries.some(
			(geometry) =>
				routeDistanceToHazardM(
					candidate.geometry,
					geometry,
					bufferM,
					undefined,
					bounds,
				) !== null,
		);
		if (!hazardous) best = candidate;
	}
	return best;
}
