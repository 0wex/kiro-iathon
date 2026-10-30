import { useTokenColors } from "@hack-the-andes-project/ui/hooks/use-token-colors";
import type { Incident } from "@hack-the-andes-project/ui/lib/incident";
import { INCIDENT_SEVERITY_TOKENS } from "@hack-the-andes-project/ui/lib/incident-constants";
import type { FeatureCollection, Geometry } from "geojson";
import type { ExpressionSpecification } from "maplibre-gl";
import { useMemo } from "react";

import { IncidentMarker } from "./incident-marker";
import {
	INCIDENT_FILL_LAYER_ID,
	INCIDENT_FILL_OPACITY_RATIO,
	INCIDENT_GEOMETRY_SOURCE_ID,
	INCIDENT_LINE_LAYER_ID,
	INCIDENT_LINE_WIDTH_PX,
	INCIDENT_POINT_LAYER_ID,
	INCIDENT_POINT_RADIUS_PX,
	INCIDENT_POINT_STROKE_WIDTH_PX,
} from "./map-constants";
import { Layer, Source } from "./map-view";

interface IncidentFeatureProperties {
	incidentId: string;
	severity: Incident["severity"];
}

export interface IncidentLayersProps {
	incidents: Incident[];
	onIncidentSelect?: (incidentId: string) => void;
}

export function IncidentLayers({
	incidents,
	onIncidentSelect,
}: IncidentLayersProps) {
	const tokenColors = useTokenColors([
		...Object.values(INCIDENT_SEVERITY_TOKENS),
		"--background",
	]);
	const criticalColor = tokenColors[INCIDENT_SEVERITY_TOKENS.critical];
	const warningColor = tokenColors[INCIDENT_SEVERITY_TOKENS.warning];
	const infoColor = tokenColors[INCIDENT_SEVERITY_TOKENS.info];
	const pointStrokeColor = tokenColors["--background"];
	const severityColor: ExpressionSpecification | null =
		criticalColor && warningColor && infoColor
			? [
					"match",
					["get", "severity"],
					"critical",
					criticalColor,
					"warning",
					warningColor,
					infoColor,
				]
			: null;
	const incidentFeatures = useMemo<
		FeatureCollection<Geometry, IncidentFeatureProperties>
	>(
		() => ({
			type: "FeatureCollection",
			features: incidents.flatMap((incident) =>
				incident.geometry
					? [
							{
								type: "Feature",
								id: incident.id,
								geometry: incident.geometry,
								properties: {
									incidentId: incident.id,
									severity: incident.severity,
								},
							},
						]
					: [],
			),
		}),
		[incidents],
	);

	return (
		<>
			{severityColor && pointStrokeColor && (
				<Source
					id={INCIDENT_GEOMETRY_SOURCE_ID}
					type="geojson"
					data={incidentFeatures}
				>
					<Layer
						id={INCIDENT_FILL_LAYER_ID}
						type="fill"
						filter={["==", ["geometry-type"], "Polygon"]}
						paint={{
							"fill-color": severityColor,
							"fill-opacity": INCIDENT_FILL_OPACITY_RATIO,
						}}
					/>
					<Layer
						id={INCIDENT_LINE_LAYER_ID}
						type="line"
						filter={[
							"match",
							["geometry-type"],
							["LineString", "Polygon"],
							true,
							false,
						]}
						paint={{
							"line-color": severityColor,
							"line-width": INCIDENT_LINE_WIDTH_PX,
						}}
					/>
					<Layer
						id={INCIDENT_POINT_LAYER_ID}
						type="circle"
						filter={["==", ["geometry-type"], "Point"]}
						paint={{
							"circle-color": severityColor,
							"circle-radius": INCIDENT_POINT_RADIUS_PX,
							"circle-stroke-color": pointStrokeColor,
							"circle-stroke-width": INCIDENT_POINT_STROKE_WIDTH_PX,
						}}
					/>
				</Source>
			)}
			{incidents.map((incident) => (
				<IncidentMarker
					key={incident.id}
					incident={incident}
					onSelect={onIncidentSelect}
				/>
			))}
		</>
	);
}
