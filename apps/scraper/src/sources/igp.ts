import type { IncidentSeverity } from "@hack-the-andes-project/db/schema/scraper";

import {
	EARTHQUAKE_CRITICAL_MAGNITUDE,
	EARTHQUAKE_WARNING_MAGNITUDE,
	IGP_LAST_QUAKE_LAYER_URL,
} from "../constants";
import { queryArcgisLayer } from "../lib/arcgis";
import { parseLimaDateTime } from "../lib/dates";
import { geometryCenter } from "../lib/geo";
import { numberAt, stringAt } from "../lib/props";
import type { IncidentRecord, IncidentSource } from "./types";

export function severityFromMagnitude(
	magnitude: number | null,
): IncidentSeverity {
	if (magnitude !== null && magnitude >= EARTHQUAKE_CRITICAL_MAGNITUDE) {
		return "critical";
	}
	if (magnitude !== null && magnitude >= EARTHQUAKE_WARNING_MAGNITUDE) {
		return "warning";
	}
	return "info";
}

// The layer only ever holds the latest quake and reuses objectid 1, so the
// local date and time act as the stable identifier across runs.
export const igpLastEarthquakeSource: IncidentSource = {
	kind: "incident",
	id: "igp_last_earthquake",
	schedule: "frequent",
	snapshot: "full",
	async fetch() {
		const features = await queryArcgisLayer({
			layerUrl: IGP_LAST_QUAKE_LAYER_URL,
			where: "1=1",
			orderByField: "objectid",
		});
		return features.flatMap((feature): IncidentRecord[] => {
			const properties = feature.properties;
			const localDate = stringAt(properties, "fecha_local");
			const localTime = stringAt(properties, "hora_local");
			if (!localDate || !localTime) {
				return [];
			}
			const magnitude = numberAt(properties, "magnitud");
			const reference = stringAt(properties, "referencia");
			const center = geometryCenter(feature.geometry);
			return [
				{
					sourceId: `${localDate}T${localTime}`,
					category: "earthquake",
					severity: severityFromMagnitude(magnitude),
					title: `Sismo M${magnitude ?? "?"}${reference ? ` · ${reference}` : ""}`,
					description: [
						stringAt(properties, "intensidad") &&
							`Intensidad: ${stringAt(properties, "intensidad")}`,
						numberAt(properties, "profundidad") !== null &&
							`Profundidad: ${numberAt(properties, "profundidad")} km`,
					]
						.filter(Boolean)
						.join("\n"),
					status: null,
					roadStatus: null,
					roadCode: null,
					roadName: null,
					roadKm: null,
					lat: center?.lat ?? numberAt(properties, "latitud"),
					lng: center?.lng ?? numberAt(properties, "longitud"),
					geometry: feature.geometry,
					region: null,
					provincia: null,
					distrito: null,
					occurredAt: parseLimaDateTime(localDate, localTime),
					sourceUpdatedAt: null,
					validFrom: null,
					validUntil: null,
					attributes: properties,
				},
			];
		});
	},
};
