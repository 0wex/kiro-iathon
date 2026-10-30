import { bomberosEmergenciesSource } from "./bomberos";
import { igpLastEarthquakeSource } from "./igp";
import {
	indeciCoenEmergenciesSource,
	indeciReliefWarehousesSource,
} from "./indeci";
import { rppNewsSource } from "./rpp";
import { senamhiWarningsSource } from "./senamhi";
import { serforWildfireAlertsSource } from "./serfor";
import { sratmaAccidentsSource } from "./sratma";
import {
	sutranAlertsSource,
	sutranAltRoutesSource,
	sutranDirectorySources,
} from "./sutran";
import type { Schedule, ScrapeSource } from "./types";

// Register new feeds here (an Apify dataset, another ArcGIS layer, a CSV
// export...): implement IncidentSource or PoiSource and add it to the list.
export const SOURCES: ScrapeSource[] = [
	sutranAlertsSource,
	indeciCoenEmergenciesSource,
	bomberosEmergenciesSource,
	senamhiWarningsSource,
	igpLastEarthquakeSource,
	serforWildfireAlertsSource,
	rppNewsSource,
	sratmaAccidentsSource,
	sutranAltRoutesSource,
	...sutranDirectorySources,
	indeciReliefWarehousesSource,
];

export function sourcesForSchedule(schedule: Schedule): ScrapeSource[] {
	return SOURCES.filter((source) => source.schedule === schedule);
}

export function findSource(id: string): ScrapeSource | undefined {
	return SOURCES.find((source) => source.id === id);
}
