import {
	type IncidentCategory,
	type IncidentSeverity,
	type PoiKind,
	ROAD_STATUSES,
	type RoadStatus,
} from "@hack-the-andes-project/db/schema/scraper";
import { z } from "zod";

import { SUTRAN_ALT_ROUTES_GEOJSON_URL, SUTRAN_API_BASE } from "../constants";
import { geoJsonFeatureCollectionSchema } from "../lib/arcgis";
import { parseIsoDate, parseLimaDate } from "../lib/dates";
import { geometryCenter, pointGeometry } from "../lib/geo";
import { fetchJson } from "../lib/http";
import { firstStringAt, stringAt } from "../lib/props";
import type { IncidentSource, PoiRecord, PoiSource } from "./types";

const envelopeSchema = z.object({
	success: z.literal(true),
	data: z.array(z.record(z.string(), z.unknown())),
});

async function fetchSutranList(path: string) {
	return envelopeSchema.parse(await fetchJson(`${SUTRAN_API_BASE}/${path}`))
		.data;
}

const alertSchema = z.looseObject({
	id: z.string(),
	codigo: z.string(),
	motivo: z.string(),
	estadoVia: z.string(),
	titulo: z.string(),
	descripcion: z.string(),
	situacionActual: z.string(),
	lat: z.number(),
	lng: z.number(),
	region: z.string(),
	provincia: z.string(),
	distrito: z.string(),
	viaCodigo: z.string(),
	viaNombre: z.string(),
	km: z.string(),
	sentido: z.string(),
	fechaEvento: z.string(),
	vigenteDesde: z.string(),
	vigenteHasta: z.string(),
	vencida: z.boolean(),
	aunNoVigente: z.boolean(),
	lastActionAt: z.string(),
});

const CATEGORY_BY_MOTIVO: Record<string, IncidentCategory> = {
	accidentes: "road_accident",
	infraestructura: "road_works",
	fenomenos_naturales: "weather",
	humano: "road_block",
};

export const SEVERITY_BY_ROAD_STATUS: Record<RoadStatus, IncidentSeverity> = {
	interrumpido: "critical",
	restringido: "warning",
	normal: "info",
};

function toRoadStatus(value: string): RoadStatus | null {
	return ROAD_STATUSES.find((status) => status === value) ?? null;
}

export const sutranAlertsSource: IncidentSource = {
	kind: "incident",
	id: "sutran_alerts",
	schedule: "frequent",
	snapshot: "full",
	async fetch() {
		const alerts = await fetchSutranList("alerts");
		return alerts.map((raw) => {
			const alert = alertSchema.parse(raw);
			const roadStatus = toRoadStatus(alert.estadoVia);
			return {
				sourceId: alert.id,
				category: CATEGORY_BY_MOTIVO[alert.motivo] ?? "other",
				severity: roadStatus ? SEVERITY_BY_ROAD_STATUS[roadStatus] : "info",
				title: alert.titulo,
				description: `${alert.descripcion}\n${alert.situacionActual}`,
				status: alert.vencida
					? "vencida"
					: alert.aunNoVigente
						? "programada"
						: "vigente",
				roadStatus,
				roadCode: alert.viaCodigo,
				roadName: alert.viaNombre,
				roadKm: alert.km,
				lat: alert.lat,
				lng: alert.lng,
				geometry: pointGeometry(alert),
				region: alert.region,
				provincia: alert.provincia,
				distrito: alert.distrito,
				occurredAt: parseLimaDate(alert.fechaEvento),
				sourceUpdatedAt: parseIsoDate(alert.lastActionAt),
				validFrom: parseLimaDate(alert.vigenteDesde),
				validUntil: parseLimaDate(alert.vigenteHasta),
				attributes: alert,
			};
		});
	},
};

const ROAD_CODE_PATTERN = /\b([A-Z]{2})\s?[-–]\s?(\d{1,4}[A-Z]{0,2})\b/g;

export function extractRoadCodes(text: string): string[] {
	const codes = new Set<string>();
	for (const match of text.matchAll(ROAD_CODE_PATTERN)) {
		codes.add(`${match[1]}-${match[2]}`);
	}
	return [...codes];
}

const altRouteSchema = z.looseObject({
	id: z.string(),
	region: z.string(),
	denominacion: z.string(),
	ruta: z.string().nullable(),
	distanciaKm: z.number().nullable(),
	restriccion: z.string().nullable(),
	tipo: z.string(),
});

export const sutranAltRoutesSource: PoiSource = {
	kind: "poi",
	id: "sutran_alt_routes",
	schedule: "daily",
	snapshot: "full",
	async fetch() {
		const [routes, geometries] = await Promise.all([
			fetchSutranList("alt-routes"),
			fetchJson(SUTRAN_ALT_ROUTES_GEOJSON_URL),
		]);
		const geometryById = new Map(
			geoJsonFeatureCollectionSchema
				.parse(geometries)
				.features.map((feature) => [
					stringAt(feature.properties, "id"),
					feature.geometry,
				]),
		);
		return routes.map((raw): PoiRecord => {
			const route = altRouteSchema.parse(raw);
			const geometry = geometryById.get(route.id) ?? null;
			const center = geometryCenter(geometry);
			return {
				sourceId: route.id,
				kind: "alt_route",
				name: route.ruta ?? route.denominacion,
				lat: center?.lat ?? null,
				lng: center?.lng ?? null,
				geometry,
				region: route.region,
				provincia: null,
				distrito: null,
				roadCodes: extractRoadCodes(route.ruta ?? ""),
				attributes: route,
			};
		});
	},
};

interface SutranDirectoryDefinition {
	id: string;
	path: string;
	kind: PoiKind;
}

const SUTRAN_DIRECTORIES: SutranDirectoryDefinition[] = [
	{ id: "sutran_fire_stations", path: "fire-stations", kind: "fire_station" },
	{
		id: "sutran_police_stations",
		path: "police-stations",
		kind: "police_station",
	},
	{
		id: "sutran_health_facilities",
		path: "health-facilities",
		kind: "health_facility",
	},
	{ id: "sutran_bus_terminals", path: "bus-terminals", kind: "bus_terminal" },
	{
		id: "sutran_weighing_stations",
		path: "weighing-stations",
		kind: "weighing_station",
	},
];

const directoryEntrySchema = z.looseObject({
	id: z.string(),
	lat: z.number().nullable(),
	lng: z.number().nullable(),
});

// Directory payloads mix English and Spanish field names per endpoint.
export const sutranDirectorySources: PoiSource[] = SUTRAN_DIRECTORIES.map(
	(definition) => ({
		kind: "poi",
		id: definition.id,
		schedule: "daily",
		snapshot: "full",
		async fetch() {
			const entries = await fetchSutranList(definition.path);
			return entries.map((raw): PoiRecord => {
				const entry = directoryEntrySchema.parse(raw);
				return {
					sourceId: entry.id,
					kind: definition.kind,
					name:
						firstStringAt(entry, ["name", "nombre", "companyName"]) ?? entry.id,
					lat: entry.lat,
					lng: entry.lng,
					geometry:
						entry.lat !== null && entry.lng !== null
							? pointGeometry({ lat: entry.lat, lng: entry.lng })
							: null,
					region: firstStringAt(entry, ["region", "departamento"]),
					provincia: firstStringAt(entry, ["province", "provincia"]),
					distrito: firstStringAt(entry, ["district", "distrito"]),
					roadCodes: null,
					attributes: entry,
				};
			});
		},
	}),
);
