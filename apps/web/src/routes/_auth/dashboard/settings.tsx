import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@hack-the-andes-project/ui/components/empty";
import { FleetConfirmationDialog } from "@hack-the-andes-project/ui/components/fleet-confirmation-dialog";
import { FleetConnectionDialog } from "@hack-the-andes-project/ui/components/fleet-connection-dialog";
import { FleetConnections } from "@hack-the-andes-project/ui/components/fleet-connections";
import { FleetQueryFeedback } from "@hack-the-andes-project/ui/components/fleet-query-feedback";
import type { FleetConnection } from "@hack-the-andes-project/ui/lib/fleet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateFleetQueries, useFleetQueries } from "@/lib/fleet-queries";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const fleetQueries = useFleetQueries();
	const queryClient = useQueryClient();
	const connectionsQuery = useQuery(fleetQueries.connections);
	const [removingConnection, setRemovingConnection] =
		useState<FleetConnection>();
	const createConnection = useMutation(
		orpc.connections.create.mutationOptions({
			onSuccess: () => toast.success("Proveedor conectado"),
			onSettled: () => invalidateFleetQueries(queryClient),
		}),
	);
	const removeConnection = useMutation(
		orpc.connections.remove.mutationOptions({
			onSuccess: () => {
				setRemovingConnection(undefined);
				toast.success("Conexión eliminada");
			},
			onSettled: () => invalidateFleetQueries(queryClient),
		}),
	);

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h2 className="type-title">Conexiones GPS</h2>
					<p className="type-body max-w-xl text-muted-foreground">
						Conecta tu proveedor para importar vehículos, seguir sus posiciones
						y planificar viajes con alertas en ruta.
					</p>
				</div>
				<FleetConnectionDialog
					isPending={createConnection.isPending}
					onCreate={createConnection.mutateAsync}
				/>
			</div>
			<FleetQueryFeedback
				isPending={connectionsQuery.isPending}
				isError={connectionsQuery.isError}
				onRetry={() => connectionsQuery.refetch()}
			/>
			{connectionsQuery.data && (
				<FleetConnections
					connections={connectionsQuery.data}
					onRemove={(connection) => {
						removeConnection.reset();
						setRemovingConnection(connection);
					}}
				/>
			)}
			{connectionsQuery.isSuccess && !connectionsQuery.data.length && (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>Conecta tu primer proveedor</EmptyTitle>
						<EmptyDescription>
							Agrega tus credenciales de Geotab o Samsara, o elige Demo para
							probar con una flota simulada. Importaremos tus vehículos y
							actualizaremos sus posiciones cada dos minutos. Luego podrás crear
							un viaje desde Flota.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
			<FleetConfirmationDialog
				pendingLabel="Guardando…"
				cancelLabel="Volver"
				errorTitle="No se pudo guardar el cambio"
				actionVariant="default"
				open={Boolean(removingConnection)}
				title="Eliminar conexión GPS"
				description={`Se eliminarán los vehículos y el historial de posiciones de «${removingConnection?.label ?? ""}», y se cancelarán sus viajes en curso.`}
				actionLabel="Eliminar conexión"
				isPending={removeConnection.isPending}
				error={removeConnection.error}
				onClose={() => setRemovingConnection(undefined)}
				onConfirm={() => {
					if (removingConnection)
						removeConnection.mutate({ id: removingConnection.id });
				}}
			/>
		</div>
	);
}
