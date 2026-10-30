import type { IncidentCategory } from "@hack-the-andes-project/db/schema/scraper";

import { BOMBEROS_24H_URL } from "../constants";
import { parseLimaDateTime } from "../lib/dates";
import { isPlausibleLatLng, pointGeometry } from "../lib/geo";
import { decodeHtmlEntities, stripHtml } from "../lib/html";
import { fetchText } from "../lib/http";
import type { IncidentRecord, IncidentSource } from "./types";

const TABLE_BODY_PATTERN = /<tbody>([\s\S]*?)<\/tbody>/;
const ROW_PATTERN = /<tr>([\s\S]*?)<\/tr>/g;
const CELL_SPAN_PATTERN = /<td[^>]*>\s*<span>([^<]*)<\/span>\s*<\/td>/g;
const ADDRESS_PATTERN = /emergency-direction"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/;
const TYPE_PATTERN = /showResumen\(\d+\)'><\/i>\s*<span>([^<]*)<\/span>/;
const STATUS_PATTERN = /<span class="badge[^"]*">[\s\S]*?<span>([^<]*)<\/span>/;
const MACHINE_PATTERN = /<li>[\s\S]*?<span>([^<]*)<\/span>\s*<\/li>/g;
const MAP_LINK_PATTERN = /showEmergency\(/;
const ADDRESS_COORDS_PATTERN =
	/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/;
const DATE_TIME_SPLIT_PATTERN = /^(\S+)\s+(.+)$/;

const CATEGORY_BY_TYPE_PREFIX: [string, IncidentCategory][] = [
	["ACCIDENTE VEHICULAR", "road_accident"],
	["INCENDIO", "fire"],
	["EMERGENCIA MEDICA", "medical"],
	["RESCATE", "rescue"],
	["DERRAME", "hazmat"],
	["FUGA", "hazmat"],
	["MATERIALES PELIGROSOS", "hazmat"],
];

export interface BomberosEmergency {
	reportNumber: string;
	reportedAtText: string;
	address: string;
	type: string;
	status: string;
	machines: string[];
	hasMap: boolean;
}

export function parseBomberosListing(html: string): BomberosEmergency[] {
	const body = html.match(TABLE_BODY_PATTERN)?.[1];
	if (body === undefined) {
		throw new Error(
			/forbidden|recaptcha/i.test(html)
				? "Bomberos listing blocked by access control"
				: "Bomberos listing table not found",
		);
	}
	const emergencies: BomberosEmergency[] = [];
	for (const [, row] of body.matchAll(ROW_PATTERN)) {
		if (!row) {
			continue;
		}
		const spans = [...row.matchAll(CELL_SPAN_PATTERN)].map((match) =>
			decodeHtmlEntities(match[1] ?? "").trim(),
		);
		const [reportNumber, reportedAtText] = spans;
		const address = row.match(ADDRESS_PATTERN)?.[1];
		const type = row.match(TYPE_PATTERN)?.[1];
		const status = row.match(STATUS_PATTERN)?.[1];
		if (!reportNumber || !reportedAtText || !address || !type || !status) {
			continue;
		}
		emergencies.push({
			reportNumber,
			reportedAtText,
			address: stripHtml(address),
			type: decodeHtmlEntities(type).trim(),
			status: decodeHtmlEntities(status).trim(),
			machines: [...row.matchAll(MACHINE_PATTERN)].map((match) =>
				decodeHtmlEntities(match[1] ?? "").trim(),
			),
			hasMap: MAP_LINK_PATTERN.test(row),
		});
	}
	return emergencies;
}

export function toBomberosIncident(
	emergency: BomberosEmergency,
): IncidentRecord {
	const coords = emergency.address.match(ADDRESS_COORDS_PATTERN);
	const point = coords
		? { lat: Number(coords[1]), lng: Number(coords[2]) }
		: null;
	const location = point && isPlausibleLatLng(point) ? point : null;
	const districtSeparator = emergency.address.lastIndexOf(" - ");
	const distrito =
		districtSeparator === -1
			? null
			: emergency.address.slice(districtSeparator + " - ".length).trim();
	const upperType = emergency.type.toUpperCase();
	const category =
		CATEGORY_BY_TYPE_PREFIX.find(([prefix]) =>
			upperType.startsWith(prefix),
		)?.[1] ?? "other";
	const attending = emergency.status.toUpperCase() === "ATENDIENDO";
	const dateParts = emergency.reportedAtText.match(DATE_TIME_SPLIT_PATTERN);
	return {
		sourceId: emergency.reportNumber,
		category,
		severity:
			attending && (category === "road_accident" || category === "fire")
				? "warning"
				: "info",
		title: emergency.type,
		description: emergency.address,
		status: emergency.status,
		roadStatus: null,
		roadCode: null,
		roadName: null,
		roadKm: null,
		lat: location?.lat ?? null,
		lng: location?.lng ?? null,
		geometry: location ? pointGeometry(location) : null,
		region: null,
		provincia: null,
		distrito: distrito && distrito.length > 0 ? distrito : null,
		occurredAt: parseLimaDateTime(dateParts?.[1], dateParts?.[2]),
		sourceUpdatedAt: null,
		validFrom: null,
		validUntil: null,
		attributes: {
			reportedAtText: emergency.reportedAtText,
			machines: emergency.machines,
			hasMap: emergency.hasMap,
		},
	};
}

export const bomberosEmergenciesSource: IncidentSource = {
	kind: "incident",
	id: "bomberos_emergencies_24h",
	schedule: "frequent",
	snapshot: "full",
	async fetch() {
		const html = await fetchText(BOMBEROS_24H_URL);
		return parseBomberosListing(html).map(toBomberosIncident);
	},
};
