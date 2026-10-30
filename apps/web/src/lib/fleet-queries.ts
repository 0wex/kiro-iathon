import type { QueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

import {
	ALERT_REFETCH_INTERVAL_MS,
	FLEET_REFETCH_INTERVAL_MS,
} from "@/constants";
import { orpc } from "@/utils/orpc";

const authRoute = getRouteApi("/_auth");

export function useFleetQueries() {
	const { session } = authRoute.useRouteContext();
	const scope = {
		sessionId: session.data?.session.id,
		organizationId: session.data?.session.activeOrganizationId,
	};
	return {
		connections: orpc.connections.list.queryOptions({
			queryKey: [...orpc.connections.list.queryKey(), scope],
			refetchInterval: FLEET_REFETCH_INTERVAL_MS,
		}),
		vehicles: orpc.vehicles.list.queryOptions({
			queryKey: [...orpc.vehicles.list.queryKey(), scope],
			refetchInterval: FLEET_REFETCH_INTERVAL_MS,
		}),
		trips: orpc.trips.list.queryOptions({
			queryKey: [...orpc.trips.list.queryKey({ input: {} }), scope],
			input: {},
			refetchInterval: FLEET_REFETCH_INTERVAL_MS,
		}),
		openAlerts: orpc.alerts.list.queryOptions({
			queryKey: [
				...orpc.alerts.list.queryKey({ input: { status: "open" } }),
				scope,
			],
			input: { status: "open" },
		}),
		acknowledgedAlerts: orpc.alerts.list.queryOptions({
			queryKey: [
				...orpc.alerts.list.queryKey({ input: { status: "acknowledged" } }),
				scope,
			],
			input: { status: "acknowledged" },
			refetchInterval: ALERT_REFETCH_INTERVAL_MS,
		}),
	};
}

export async function invalidateFleetQueries(queryClient: QueryClient) {
	await Promise.all(
		[
			orpc.connections.key(),
			orpc.vehicles.key(),
			orpc.trips.key(),
			orpc.alerts.key(),
		].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
	);
}
