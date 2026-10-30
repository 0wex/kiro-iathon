import type { Database } from "@iathon-kiro/db";
import { incident } from "@iathon-kiro/db/schema/scraper";
import { eq } from "drizzle-orm";

import { isAlertableIncident } from "../hazards/alertable";
import type { HazardIncident } from "../hazards/types";

export async function loadAlertableIncidents(
	db: Database,
): Promise<HazardIncident[]> {
	const activeIncidents = await db
		.select({
			id: incident.id,
			category: incident.category,
			severity: incident.severity,
			title: incident.title,
			geometry: incident.geometry,
			lat: incident.lat,
			lng: incident.lng,
		})
		.from(incident)
		.where(eq(incident.active, true));
	return activeIncidents.filter(isAlertableIncident);
}
