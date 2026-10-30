import { MS_PER_SECOND } from "../constants";
import { effectiveSpeedMps } from "./speed";
import type { RouteCandidate, RouteProgress, VehicleState } from "./types";

export interface EstimateEtaInput {
	route: RouteCandidate;
	progress: RouteProgress;
	vehicle: VehicleState;
	now: Date;
}

export function estimateEta({
	route,
	progress,
	vehicle,
	now,
}: EstimateEtaInput): Date {
	const speedMps = effectiveSpeedMps(route, vehicle);
	const remainingS =
		speedMps > 0 ? progress.remainingDistanceM / speedMps : route.durationS;
	return new Date(now.getTime() + remainingS * MS_PER_SECOND);
}
