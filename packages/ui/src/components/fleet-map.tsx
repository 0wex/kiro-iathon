import type { Geometry } from "geojson";
import { LngLatBounds } from "maplibre-gl";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import type { FleetTrip, FleetVehicle } from "../lib/fleet";
import {
	EMPTY_FLEET_TRIPS,
	EMPTY_FLEET_VEHICLES,
} from "../lib/fleet-constants";
import { geometryPositions } from "../lib/fleet-map";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { FleetOverlay } from "./fleet-overlay";
import {
	FLEET_MAP_FIT_DURATION_MS,
	FLEET_MAP_MAX_ZOOM_LEVEL,
	FLEET_MAP_PADDING_PX,
} from "./map-constants";
import { type MapRef, MapView, NavigationControl } from "./map-view";
import { Skeleton } from "./skeleton";

export interface FleetMapProps {
	vehicles?: FleetVehicle[];
	trips?: FleetTrip[];
	focusKey?: string;
	focusGeometry?: Geometry | null;
	children?: ReactNode;
	label?: string;
}

export function FleetMap({
	vehicles = EMPTY_FLEET_VEHICLES,
	trips = EMPTY_FLEET_TRIPS,
	focusKey = "fleet",
	focusGeometry,
	children,
	label = "Mapa de la flota",
}: FleetMapProps) {
	const mapRef = useRef<MapRef>(null);
	const fittedKey = useRef<string>(undefined);
	const [isLoaded, setIsLoaded] = useState(false);
	const [hasError, setHasError] = useState(false);
	const bounds = useMemo(() => {
		const mapBounds = new LngLatBounds();
		const positions = [
			...vehicles.flatMap((vehicle) =>
				vehicle.lastLat !== null && vehicle.lastLng !== null
					? [[vehicle.lastLng, vehicle.lastLat]]
					: [],
			),
			...trips.flatMap((trip) => geometryPositions(trip.routeGeometry)),
			...(focusGeometry ? geometryPositions(focusGeometry) : []),
		];
		for (const [longitude, latitude] of positions) {
			if (longitude !== undefined && latitude !== undefined)
				mapBounds.extend([longitude, latitude]);
		}
		return mapBounds;
	}, [vehicles, trips, focusGeometry]);

	useEffect(() => {
		if (!isLoaded || bounds.isEmpty() || fittedKey.current === focusKey) return;
		mapRef.current?.fitBounds(bounds, {
			padding: FLEET_MAP_PADDING_PX,
			maxZoom: FLEET_MAP_MAX_ZOOM_LEVEL,
			duration: FLEET_MAP_FIT_DURATION_MS,
		});
		fittedKey.current = focusKey;
	}, [isLoaded, bounds, focusKey]);

	return (
		<section
			aria-label={label}
			className="relative h-96 min-w-0 overflow-hidden border bg-muted"
		>
			<MapView
				ref={mapRef}
				cursor="grab"
				onLoad={() => setIsLoaded(true)}
				onError={() => setHasError(true)}
			>
				<NavigationControl position="top-right" />
				<FleetOverlay vehicles={vehicles} trips={trips} />
				{children}
			</MapView>
			{!isLoaded && !hasError && (
				<output
					aria-label="Cargando mapa"
					className="pointer-events-none absolute inset-0 p-4"
				>
					<Skeleton className="size-full" />
				</output>
			)}
			{hasError && (
				<Alert className="absolute top-3 left-3 max-w-xs">
					<AlertTitle>Mapa parcialmente disponible</AlertTitle>
					<AlertDescription>
						No se pudieron cargar todos los recursos. Revisa tu conexión y
						vuelve a cargar la página.
					</AlertDescription>
				</Alert>
			)}
		</section>
	);
}
