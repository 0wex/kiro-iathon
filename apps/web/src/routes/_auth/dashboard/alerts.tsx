import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@hack-the-andes-project/ui/components/alert";
import { AlertCard } from "@hack-the-andes-project/ui/components/alert-card";
import { AlertMap } from "@hack-the-andes-project/ui/components/alert-map";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@hack-the-andes-project/ui/components/empty";
import { Field, FieldLabel } from "@hack-the-andes-project/ui/components/field";
import { FleetQueryFeedback } from "@hack-the-andes-project/ui/components/fleet-query-feedback";
import { Switch } from "@hack-the-andes-project/ui/components/switch";
import { EMPTY_FLEET_ALERTS } from "@hack-the-andes-project/ui/lib/fleet-constants";
import { INCIDENT_SEVERITY_OPTIONS } from "@hack-the-andes-project/ui/lib/incident-constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
	DEFAULT_INCIDENT_LIMIT_ROWS,
	EMPTY_INCIDENTS,
	INCIDENT_REFETCH_INTERVAL_MS,
} from "@/constants";
import { invalidateFleetQueries, useFleetQueries } from "@/lib/fleet-queries";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard/alerts")({
	component: AlertsPage,
});

function AlertsPage() {
	const fleetQueries = useFleetQueries();
	const queryClient = useQueryClient();
	const [showAcknowledged, setShowAcknowledged] = useState(false);
	const [selectedAlertId, setSelectedAlertId] = useState<string>();
	const openAlertsQuery = useQuery(fleetQueries.openAlerts);
	const acknowledgedAlertsQuery = useQuery({
		...fleetQueries.acknowledgedAlerts,
		enabled: showAcknowledged,
	});
	const tripsQuery = useQuery(fleetQueries.trips);
	const vehiclesQuery = useQuery(fleetQueries.vehicles);
	const incidentsQuery = useQuery({
		...orpc.incidents.list.queryOptions({
			input: {
				severities: INCIDENT_SEVERITY_OPTIONS,
				limit: DEFAULT_INCIDENT_LIMIT_ROWS,
			},
		}),
		refetchInterval: INCIDENT_REFETCH_INTERVAL_MS,
	});
	const alerts = [
		...(openAlertsQuery.data ?? EMPTY_FLEET_ALERTS),
		...(showAcknowledged
			? (acknowledgedAlertsQuery.data ?? EMPTY_FLEET_ALERTS)
			: EMPTY_FLEET_ALERTS),
	];
	const [firstAlert] = alerts;
	const selectedAlert =
		alerts.find((alert) => alert.id === selectedAlertId) ?? firstAlert;
	const selectedTrip = tripsQuery.data?.find(
		(trip) => trip.id === selectedAlert?.tripId,
	);
	const selectedVehicle = vehiclesQuery.data?.find(
		(vehicle) => vehicle.id === selectedTrip?.vehicleId,
	);
	const acknowledge = useMutation(
		orpc.alerts.acknowledge.mutationOptions({
			onSuccess: () => toast.success("Alerta reconocida"),
			onSettled: () => invalidateFleetQueries(queryClient),
		}),
	);

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h2 className="type-title">Riesgos por delante</h2>
					<p className="type-body text-muted-foreground">
						Revisa las alertas de tus viajes y sus rutas alternativas. Se
						actualizan cada 30 segundos.
					</p>
				</div>
				<Field orientation="horizontal" className="w-auto">
					<Switch
						id="show-acknowledged"
						checked={showAcknowledged}
						onCheckedChange={setShowAcknowledged}
					/>
					<FieldLabel htmlFor="show-acknowledged">
						Mostrar reconocidas
					</FieldLabel>
				</Field>
			</div>
			<FleetQueryFeedback
				isPending={openAlertsQuery.isPending}
				isError={openAlertsQuery.isError}
				onRetry={() => openAlertsQuery.refetch()}
			/>
			{showAcknowledged && (
				<FleetQueryFeedback
					isPending={acknowledgedAlertsQuery.isPending}
					isError={acknowledgedAlertsQuery.isError}
					onRetry={() => acknowledgedAlertsQuery.refetch()}
				/>
			)}
			{acknowledge.error && (
				<Alert variant="destructive">
					<AlertTitle>No se pudo reconocer la alerta</AlertTitle>
					<AlertDescription>{acknowledge.error.message}</AlertDescription>
				</Alert>
			)}
			{Boolean(alerts.length) && (
				<div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
					<section
						aria-label="Alertas de viajes"
						className="flex min-w-0 flex-col gap-4"
					>
						{alerts.map((alert) => (
							<AlertCard
								key={alert.id}
								alert={alert}
								selected={alert.id === selectedAlert?.id}
								isAcknowledging={acknowledge.isPending}
								onSelect={() => {
									setSelectedAlertId(alert.id);
									requestAnimationFrame(() =>
										document
											.getElementById("alert-map-detail")
											?.scrollIntoView({ block: "nearest" }),
									);
								}}
								onAcknowledge={() => acknowledge.mutate({ id: alert.id })}
							/>
						))}
					</section>
					<div
						id="alert-map-detail"
						className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4"
					>
						<FleetQueryFeedback
							isPending={tripsQuery.isPending}
							isError={tripsQuery.isError}
							onRetry={() => tripsQuery.refetch()}
						/>
						{selectedAlert && (
							<AlertMap
								alert={selectedAlert}
								trip={selectedTrip}
								vehicle={selectedVehicle}
								incidents={incidentsQuery.data ?? EMPTY_INCIDENTS}
							/>
						)}
					</div>
				</div>
			)}
			{openAlertsQuery.isSuccess &&
				(!showAcknowledged || acknowledgedAlertsQuery.isSuccess) &&
				!alerts.length && (
					<Empty className="border">
						<EmptyHeader>
							<EmptyTitle>
								{showAcknowledged
									? "No hay alertas para mostrar"
									: "No tienes alertas abiertas"}
							</EmptyTitle>
							<EmptyDescription>
								Las alertas aparecerán cuando un incidente afecte el recorrido
								de un viaje en curso.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
		</div>
	);
}
