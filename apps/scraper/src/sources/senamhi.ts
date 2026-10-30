import type {
	IncidentCategory,
	IncidentSeverity,
} from "@hack-the-andes-project/db/schema/scraper";

import {
	ARCGIS_GEOMETRY_PRECISION,
	ARCGIS_MAX_ALLOWABLE_OFFSET_DEG,
	SENAMHI_MAPSERVER_BASE,
} from "../constants";
import { epochMsToDate, queryArcgisLayer } from "../lib/arcgis";
import { geometryCenter } from "../lib/geo";
import { numberAt, stringAt } from "../lib/props";
import type { IncidentRecord, IncidentSource } from "./types";

interface SenamhiLayerDefinition {
	layerId: number;
	label: string;
	category: IncidentCategory;
}

const SENAMHI_LAYERS: SenamhiLayerDefinition[] = [
	{ layerId: 5, label: "Aviso de precipitación", category: "rain_warning" },
	{
		layerId: 2,
		label: "Aviso de activación de quebradas",
		category: "flood_warning",
	},
	{ layerId: 4, label: "Aviso hidrológico", category: "flood_warning" },
];

const WARNING_LEVEL_PATTERN = /(\d)/;

// SENAMHI levels run 1 (low) to 4 (very high).
export function severityFromWarningLevel(
	level: string | number | null,
): IncidentSeverity {
	const digit =
		level === null ? null : String(level).match(WARNING_LEVEL_PATTERN)?.[1];
	if (digit === "3" || digit === "4") {
		return "critical";
	}
	if (digit === "2") {
		return "warning";
	}
	return "info";
}

export const senamhiWarningsSource: IncidentSource = {
	kind: "incident",
	id: "senamhi_warnings",
	schedule: "frequent",
	snapshot: "full",
	async fetch() {
		const layers = await Promise.all(
			SENAMHI_LAYERS.map(async (definition) => ({
				definition,
				features: await queryArcgisLayer({
					layerUrl: `${SENAMHI_MAPSERVER_BASE}/${definition.layerId}`,
					where: "1=1",
					orderByField: "OBJECTID",
					extraParams: {
						geometryPrecision: ARCGIS_GEOMETRY_PRECISION,
						maxAllowableOffset: ARCGIS_MAX_ALLOWABLE_OFFSET_DEG,
					},
				}),
			})),
		);
		return layers.flatMap(({ definition, features }) =>
			features.flatMap((feature): IncidentRecord[] => {
				const properties = feature.properties;
				const objectId = numberAt(properties, "OBJECTID");
				if (objectId === null) {
					return [];
				}
				const level = stringAt(properties, "NIVEL");
				const region = stringAt(properties, "NOMBDEP");
				const provincia = stringAt(properties, "NOMBPROV");
				const distrito = stringAt(properties, "NOMBDIST");
				const place = [distrito, provincia, region].filter(Boolean).join(", ");
				const center = geometryCenter(feature.geometry);
				const description = [
					stringAt(properties, "DESCRIPCIO"),
					stringAt(properties, "RECOMENDAC"),
				]
					.filter(Boolean)
					.join("\n");
				return [
					{
						sourceId: `${definition.layerId}:${objectId}`,
						category: definition.category,
						severity: severityFromWarningLevel(level),
						title:
							stringAt(properties, "TITULO") ??
							`${definition.label} · ${level ?? "sin nivel"}${place ? ` · ${place}` : ""}`,
						description: description.length > 0 ? description : null,
						status: level,
						roadStatus: null,
						roadCode: null,
						roadName: null,
						roadKm: null,
						lat: center?.lat ?? numberAt(properties, "LATITUD"),
						lng: center?.lng ?? numberAt(properties, "LONGITUD"),
						geometry: feature.geometry,
						region,
						provincia,
						distrito,
						occurredAt: epochMsToDate(properties.FECHA),
						sourceUpdatedAt: epochMsToDate(properties.FECHA_ETL),
						validFrom: null,
						validUntil: null,
						attributes: properties,
					},
				];
			}),
		);
	},
};
