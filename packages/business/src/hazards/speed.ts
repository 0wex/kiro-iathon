import { KMH_TO_MPS, MIN_SPEED_FOR_ETA_KMH } from "../constants";
import type { RouteCandidate, VehicleState } from "./types";

export function effectiveSpeedMps(
	route: Pick<RouteCandidate, "distanceM" | "durationS">,
	vehicle: Pick<VehicleState, "speedKmh">,
): number {
	if (vehicle.speedKmh !== null && vehicle.speedKmh >= MIN_SPEED_FOR_ETA_KMH) {
		return vehicle.speedKmh * KMH_TO_MPS;
	}
	return route.durationS > 0 ? route.distanceM / route.durationS : 0;
}
