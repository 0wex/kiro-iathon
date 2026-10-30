import type { Incident } from "@hack-the-andes-project/ui/lib/incident";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "./alert";
import { IncidentLayers } from "./incident-layers";
import { INCIDENT_INTERACTIVE_LAYER_IDS } from "./map-constants";
import { MapLegend } from "./map-legend";
import { type MapProps, MapView, NavigationControl } from "./map-view";
import { Skeleton } from "./skeleton";

export interface IncidentMapProps extends MapProps {
	incidents: Incident[];
	onIncidentSelect: (incidentId: string) => void;
}

export function IncidentMap({
	incidents,
	onIncidentSelect,
	children,
	onClick,
	onLoad,
	onError,
	interactiveLayerIds,
	...props
}: IncidentMapProps) {
	const [isMapLoading, setIsMapLoading] = useState(true);
	const [hasMapError, setHasMapError] = useState(false);
	return (
		<section
			className="relative size-full overflow-hidden bg-muted"
			aria-label="Mapa de incidentes en Perú"
		>
			<MapView
				{...props}
				interactiveLayerIds={[
					...INCIDENT_INTERACTIVE_LAYER_IDS,
					...(interactiveLayerIds ?? []),
				]}
				onClick={(event) => {
					const incidentId = event.features?.find(
						(feature) => feature.properties?.incidentId,
					)?.properties.incidentId;
					if (typeof incidentId === "string") onIncidentSelect(incidentId);
					onClick?.(event);
				}}
				onLoad={(event) => {
					setIsMapLoading(false);
					setHasMapError(false);
					onLoad?.(event);
				}}
				onError={(event) => {
					setIsMapLoading(false);
					setHasMapError(true);
					onError?.(event);
				}}
			>
				<NavigationControl position="top-right" />
				<IncidentLayers
					incidents={incidents}
					onIncidentSelect={onIncidentSelect}
				/>
				{children}
			</MapView>
			{isMapLoading && (
				<output
					className="pointer-events-none absolute inset-0 block p-4"
					aria-label="Cargando mapa"
				>
					<Skeleton className="size-full" />
				</output>
			)}
			{hasMapError && (
				<Alert className="absolute top-3 left-3 max-w-xs">
					<AlertTitle>Mapa parcialmente disponible</AlertTitle>
					<AlertDescription>
						No se pudieron cargar todos los recursos del mapa. Revisa tu
						conexión y vuelve a cargar la página.
					</AlertDescription>
				</Alert>
			)}
			<MapLegend className="pointer-events-none absolute bottom-20 left-3 max-w-[calc(100%-1.5rem)] sm:bottom-9" />
		</section>
	);
}
