import { bearing } from "@turf/bearing";
import { destination } from "@turf/destination";
import { distance } from "@turf/distance";
import type { Position } from "geojson";

import {
	DEMO_CLEAR_TRIP_BEARINGS_DEG,
	DEMO_CLEAR_TRIP_DISTANCE_M,
	DEMO_HAZARD_MAX_DISTANCE_M,
	DEMO_HAZARD_MIN_DISTANCE_M,
	DEMO_HAZARD_OVERSHOOT_M,
	DEMO_TRIP_MAX_ATTEMPTS_COUNT,
	DEMO_TRIP_MIN_ROUTE_DISTANCE_M,
	type DEMO_TRIP_SCENARIOS,
} from "../constants";
import { findHazardsAhead } from "../hazards/hazards-ahead";
import type { HazardIncident, LatLng, RouteCandidate } from "../hazards/types";
import { fetchRouteCandidates } from "../routing/osrm";

export type DemoTripScenario = (typeof DEMO_TRIP_SCENARIOS)[number];

export interface PlanDemoTripInput {
	osrmBaseUrl: string;
	origin: LatLng;
	scenario: DemoTripScenario;
	incidents: HazardIncident[];
	fetchImpl?: typeof fetch;
}

export interface DemoTripPlan {
	destination: LatLng;
	incident: HazardIncident | null;
}

interface DemoTripCandidate {
	coordinates: Position;
	incident: HazardIncident | null;
}

export async function planDemoTrip({
	osrmBaseUrl,
	origin,
	scenario,
	incidents,
	fetchImpl,
}: PlanDemoTripInput): Promise<DemoTripPlan | null> {
	const originCoordinates = [origin.lng, origin.lat];
	const incidentPoints = incidents.flatMap((incident) =>
		incident.lat === null || incident.lng === null
			? []
			: [
					{
						incident,
						coordinates: [incident.lng, incident.lat],
						distanceM: distance(
							originCoordinates,
							[incident.lng, incident.lat],
							{ units: "meters" },
						),
					},
				],
	);
	const candidates: DemoTripCandidate[] =
		scenario === "hazard"
			? incidentPoints
					.filter(
						({ distanceM }) =>
							distanceM >= DEMO_HAZARD_MIN_DISTANCE_M &&
							distanceM <= DEMO_HAZARD_MAX_DISTANCE_M,
					)
					.sort((left, right) => left.distanceM - right.distanceM)
					.flatMap(({ incident, coordinates }) => [
						{
							// Aiming past the incident, away from the truck, makes the road
							// route run through it instead of stopping at it. The overshoot
							// can land on unroutable terrain (sea, mountains, across a
							// border), so the incident point itself is the fallback.
							coordinates: destination(
								coordinates,
								DEMO_HAZARD_OVERSHOOT_M,
								bearing(originCoordinates, coordinates),
								{ units: "meters" },
							).geometry.coordinates,
							incident,
						},
						{ coordinates, incident },
					])
			: DEMO_CLEAR_TRIP_BEARINGS_DEG.map((bearingDeg) => {
					const { coordinates } = destination(
						originCoordinates,
						DEMO_CLEAR_TRIP_DISTANCE_M,
						bearingDeg,
						{ units: "meters" },
					).geometry;
					return {
						coordinates,
						incident: null,
						clearanceM: Math.min(
							...incidentPoints.map((point) =>
								distance(coordinates, point.coordinates, { units: "meters" }),
							),
						),
					};
				}).sort((left, right) => right.clearanceM - left.clearanceM);
	const vehicle = {
		position: origin,
		speedKmh: null,
		heading: null,
		recordedAt: new Date(),
	};
	let routedCandidatesCount = 0;
	let lastRoutingError: Error | null = null;
	for (const candidate of candidates.slice(0, DEMO_TRIP_MAX_ATTEMPTS_COUNT)) {
		const [lng, lat] = candidate.coordinates;
		if (lng === undefined || lat === undefined) continue;
		let routes: RouteCandidate[];
		try {
			routes = await fetchRouteCandidates({
				baseUrl: osrmBaseUrl,
				origin,
				destination: { lat, lng },
				fetchImpl,
			});
		} catch (cause: unknown) {
			lastRoutingError =
				cause instanceof Error ? cause : new Error(String(cause));
			continue;
		}
		routedCandidatesCount += 1;
		const [route] = routes;
		if (!route) continue;
		if (route.distanceM < DEMO_TRIP_MIN_ROUTE_DISTANCE_M) continue;
		const hazards = findHazardsAhead({
			route,
			vehicle,
			incidents: candidate.incident ? [candidate.incident] : incidents,
		});
		if (candidate.incident ? hazards.length > 0 : hazards.length === 0) {
			return { destination: { lat, lng }, incident: candidate.incident };
		}
	}
	if (routedCandidatesCount === 0 && lastRoutingError) {
		throw new Error(
			`Every demo trip candidate failed to route: ${lastRoutingError.message}`,
			{ cause: lastRoutingError },
		);
	}
	return null;
}
