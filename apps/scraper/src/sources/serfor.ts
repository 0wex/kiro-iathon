import type { IncidentSeverity } from "@hack-the-andes-project/db/schema/scraper";

import {
	MS_PER_DAY,
	SERFOR_LOOKBACK_DAYS,
	SERFOR_WILDFIRE_ALERTS_LAYER_URL,
} from "../constants";
import { epochMsToDate, queryArcgisLayer } from "../lib/arcgis";
import { toIsoDay } from "../lib/dates";
import { geometryCenter } from "../lib/geo";
import { numberAt, stringAt } from "../lib/props";
import type { IncidentRecord, IncidentSource } from "./types";

// ESTADO coded values published by the layer metadata.
const WILDFIRE_STATES: Record<
	number,
	{ label: string; severity: IncidentSeverity }
> = {
	1: { label: "Alertado", severity: "warning" },
	2: { label: "Confirmado", severity: "critical" },
	3: { label: "Controlado", severity: "info" },
	4: { label: "Extinguido", severity: "info" },
};

export const serforWildfireAlertsSource: IncidentSource = {
	kind: "incident",
	id: "serfor_wildfire_alerts",
	schedule: "frequent",
	snapshot: "full",
	async fetch({ now }) {
		const since = toIsoDay(
			new Date(now.getTime() - SERFOR_LOOKBACK_DAYS * MS_PER_DAY),
		);
		const features = await queryArcgisLayer({
			layerUrl: SERFOR_WILDFIRE_ALERTS_LAYER_URL,
			where: `ESTADO IN (1,2,3) AND FECHA >= DATE '${since}'`,
			orderByField: "OBJECTID",
		});
		return features.flatMap((feature): IncidentRecord[] => {
			const properties = feature.properties;
			const objectId = numberAt(properties, "OBJECTID");
			if (objectId === null) {
				return [];
			}
			const state = WILDFIRE_STATES[numberAt(properties, "ESTADO") ?? 0];
			const center = geometryCenter(feature.geometry);
			const distrito = stringAt(properties, "NOMDIS");
			const provincia = stringAt(properties, "NOMPRO");
			const region = stringAt(properties, "NOMDEP");
			return [
				{
					sourceId: String(objectId),
					category: "wildfire",
					severity: state?.severity ?? "warning",
					title: `Incendio forestal ${state?.label.toLowerCase() ?? ""} · ${[distrito, provincia, region].filter(Boolean).join(", ")}`,
					description: stringAt(properties, "TIPCOB"),
					status: state?.label ?? null,
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
					sourceUpdatedAt: epochMsToDate(properties.last_edited_date),
					validFrom: null,
					validUntil: null,
					attributes: properties,
				},
			];
		});
	},
};
