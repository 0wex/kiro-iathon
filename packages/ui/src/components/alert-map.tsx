import type { Geometry } from "geojson";
import { useTokenColors } from "../hooks/use-token-colors";

import type { FleetAlert, FleetTrip, FleetVehicle } from "../lib/fleet";
import { EMPTY_FLEET_VEHICLES } from "../lib/fleet-constants";
import { formatFleetDistance, formatFleetDuration } from "../lib/fleet-format";
import type { Incident } from "../lib/incident";
import { INCIDENT_SEVERITY_TOKENS } from "../lib/incident-constants";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { FleetMap } from "./fleet-map";
import { FleetRouteLayer } from "./fleet-route-layer";
import { IncidentLayers } from "./incident-layers";
import {
	FLEET_HAZARD_FILL_LAYER_ID,
	FLEET_HAZARD_LINE_LAYER_ID,
	FLEET_HAZARD_POINT_LAYER_ID,
	FLEET_HAZARD_SOURCE_ID,
	INCIDENT_FILL_OPACITY_RATIO,
	INCIDENT_LINE_WIDTH_PX,
	INCIDENT_POINT_RADIUS_PX,
	INCIDENT_POINT_STROKE_WIDTH_PX,
} from "./map-constants";
import { Layer, Source } from "./map-view";
import { SeverityBadge } from "./severity";

export interface AlertMapProps {
	alert: FleetAlert;
	trip?: FleetTrip;
	vehicle?: FleetVehicle;
	incidents: Incident[];
}

export function AlertMap({ alert, trip, vehicle, incidents }: AlertMapProps) {
	const tokenColors = useTokenColors([
		INCIDENT_SEVERITY_TOKENS[alert.severity],
		"--background",
	]);
	const incident = alert.incident;
	const hazardGeometry: Geometry | null =
		incident?.geometry ??
		(incident && incident.lat !== null && incident.lng !== null
			? { type: "Point", coordinates: [incident.lng, incident.lat] }
			: null);
	const alternative = alert.alternativeRoute;
	const geometries: Geometry[] = [];
	if (trip) geometries.push(trip.routeGeometry);
	if (hazardGeometry) geometries.push(hazardGeometry);
	if (alternative) geometries.push(alternative.geometry);
	const distanceDeltaM =
		alternative && trip ? alternative.distanceM - trip.routeDistanceM : null;
	const durationDeltaS =
		alternative && trip ? alternative.durationS - trip.routeDurationS : null;
	const hazardColor = tokenColors[INCIDENT_SEVERITY_TOKENS[alert.severity]];

	return (
		<section
			aria-label={`Detalle de ${alert.title}`}
			className="flex min-w-0 flex-col gap-3"
		>
			<h2 className="type-heading">{alert.title}</h2>
			<FleetMap
				label="Ruta y riesgo seleccionado"
				vehicles={vehicle ? [vehicle] : EMPTY_FLEET_VEHICLES}
				focusKey={`${alert.id}-${trip?.id ?? "no-trip"}`}
				focusGeometry={{ type: "GeometryCollection", geometries }}
			>
				<IncidentLayers incidents={incidents} />
				{trip && (
					<FleetRouteLayer
						id={`alert-${trip.id}`}
						geometry={trip.routeGeometry}
					/>
				)}
				{alternative && (
					<FleetRouteLayer
						id={`alternative-${alert.id}`}
						geometry={alternative.geometry}
						alternative
					/>
				)}
				{hazardGeometry && hazardColor && tokenColors["--background"] && (
					<Source
						id={FLEET_HAZARD_SOURCE_ID}
						type="geojson"
						data={hazardGeometry}
					>
						<Layer
							id={FLEET_HAZARD_FILL_LAYER_ID}
							type="fill"
							filter={["==", ["geometry-type"], "Polygon"]}
							paint={{
								"fill-color": hazardColor,
								"fill-opacity": INCIDENT_FILL_OPACITY_RATIO,
							}}
						/>
						<Layer
							id={FLEET_HAZARD_LINE_LAYER_ID}
							type="line"
							filter={[
								"match",
								["geometry-type"],
								["LineString", "Polygon"],
								true,
								false,
							]}
							paint={{
								"line-color": hazardColor,
								"line-width": INCIDENT_LINE_WIDTH_PX,
							}}
						/>
						<Layer
							id={FLEET_HAZARD_POINT_LAYER_ID}
							type="circle"
							filter={["==", ["geometry-type"], "Point"]}
							paint={{
								"circle-color": hazardColor,
								"circle-radius": INCIDENT_POINT_RADIUS_PX,
								"circle-stroke-color": tokenColors["--background"],
								"circle-stroke-width": INCIDENT_POINT_STROKE_WIDTH_PX,
							}}
						/>
					</Source>
				)}
			</FleetMap>
			<section
				className="type-label flex flex-wrap gap-4"
				aria-label="Leyenda del mapa"
			>
				<span className="flex items-center gap-2">
					<span className="w-6 border-chart-1 border-t-2" />
					Ruta del viaje
				</span>
				{alternative && (
					<span className="flex items-center gap-2">
						<span className="w-6 border-chart-3 border-t-2 border-dashed" />
						Ruta alternativa
					</span>
				)}
				<span className="flex items-center gap-2">
					Riesgo
					<SeverityBadge severity={alert.severity} />
				</span>
			</section>
			{!hazardGeometry && (
				<p className="type-body text-muted-foreground">
					El incidente no tiene una ubicación disponible.
				</p>
			)}
			{!trip && (
				<p className="type-body text-muted-foreground">
					La ruta original del viaje no está disponible.
				</p>
			)}
			{alternative ? (
				<Alert>
					<AlertTitle>Ruta alternativa disponible</AlertTitle>
					<AlertDescription>
						<p className="type-data">
							{formatFleetDistance(alternative.distanceM)} ·{" "}
							{formatFleetDuration(alternative.durationS)}
						</p>
						{distanceDeltaM !== null && durationDeltaS !== null && (
							<p className="type-data">
								Respecto a la ruta del viaje: {distanceDeltaM > 0 ? "+" : ""}
								{formatFleetDistance(distanceDeltaM)} ·{" "}
								{durationDeltaS > 0 ? "+" : ""}
								{formatFleetDuration(durationDeltaS)}.
							</p>
						)}
					</AlertDescription>
				</Alert>
			) : (
				<p className="type-body text-muted-foreground">
					No hay una ruta alternativa disponible para esta alerta.
				</p>
			)}
		</section>
	);
}
