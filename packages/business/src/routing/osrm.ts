import type { LineString } from "geojson";
import { z } from "zod";

import {
	MIN_ROUTE_COORDINATES_COUNT,
	ROUTING_REQUEST_TIMEOUT_MS,
	ROUTING_USER_AGENT,
} from "../constants";
import type { LatLng, RouteCandidate } from "../hazards/types";

const osrmResponseSchema = z.object({
	code: z.string(),
	message: z.string().optional(),
	routes: z
		.array(
			z.object({
				distance: z.number().nonnegative(),
				duration: z.number().nonnegative(),
				geometry: z.object({
					type: z.literal("LineString"),
					coordinates: z
						.array(z.tuple([z.number(), z.number()]))
						.min(MIN_ROUTE_COORDINATES_COUNT),
				}),
			}),
		)
		.default([]),
});

export interface FetchRouteCandidatesInput {
	baseUrl: string;
	origin: LatLng;
	destination: LatLng;
	// Points the route must pass through, in order, between origin and destination.
	waypoints?: LatLng[];
	fetchImpl?: typeof fetch;
}

export async function fetchRouteCandidates({
	baseUrl,
	origin,
	destination,
	waypoints = [],
	fetchImpl = fetch,
}: FetchRouteCandidatesInput): Promise<RouteCandidate[]> {
	const coordinates = [origin, ...waypoints, destination]
		.map((point) => `${point.lng},${point.lat}`)
		.join(";");
	// OSRM's car profile keeps going straight through a waypoint, so a point on
	// a detour's far end forces a loop to the next turnaround; allowing U-turns
	// there keeps the detour route on the detour.
	const waypointOptions =
		waypoints.length > 0 ? "&continue_straight=false" : "";
	const url = `${baseUrl.replace(/\/$/, "")}/route/v1/driving/${coordinates}?alternatives=true&overview=full&geometries=geojson&steps=false${waypointOptions}`;
	// The public OSRM server answers 403 to requests without a User-Agent, and
	// the Workers fetch sends none by default.
	const response = await fetchImpl(url, {
		headers: { "User-Agent": ROUTING_USER_AGENT },
		signal: AbortSignal.timeout(ROUTING_REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`OSRM route request failed with HTTP ${response.status}`);
	}
	const body = osrmResponseSchema.parse(await response.json());
	if (body.code !== "Ok") {
		throw new Error(
			`OSRM route request failed with code ${body.code}${body.message ? `: ${body.message}` : ""} (${url})`,
		);
	}
	return body.routes.map((route) => {
		const geometry: LineString = {
			type: "LineString",
			coordinates: route.geometry.coordinates,
		};
		return {
			geometry,
			distanceM: route.distance,
			durationS: route.duration,
		};
	});
}
