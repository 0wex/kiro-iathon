import type {
	IncidentCategory,
	IncidentSeverity,
} from "@hack-the-andes-project/db/schema/scraper";

import type { HazardIncident } from "./types";

export const ALERTABLE_INCIDENTS: Partial<
	Record<IncidentCategory, readonly IncidentSeverity[]>
> = {
	weather: ["warning", "critical"],
	rain_warning: ["warning", "critical"],
	flood_warning: ["warning", "critical"],
	flood: ["info", "warning", "critical"],
	landslide: ["info", "warning", "critical"],
	road_block: ["info", "warning", "critical"],
	road_works: ["warning", "critical"],
	road_accident: ["warning", "critical"],
	wildfire: ["warning", "critical"],
	fire: ["warning", "critical"],
	earthquake: ["warning", "critical"],
	hazmat: ["warning", "critical"],
};

export function isAlertableIncident(
	incident: Pick<HazardIncident, "category" | "severity">,
): boolean {
	return Boolean(
		ALERTABLE_INCIDENTS[incident.category]?.includes(incident.severity),
	);
}
