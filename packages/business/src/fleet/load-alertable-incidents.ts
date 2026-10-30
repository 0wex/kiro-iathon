import type { Database } from "@hack-the-andes-project/db";
import { incident } from "@hack-the-andes-project/db/schema/scraper";
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
