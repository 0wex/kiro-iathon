import catalogue from "./events.json";

export type DisasterKind = "huayco" | "inundacion" | "deslizamiento";

export const DISASTER_KIND_LABELS: Record<DisasterKind, string> = {
	huayco: "Huayco",
	inundacion: "Inundación",
	deslizamiento: "Deslizamiento",
};

export interface LonLat {
	lon: number;
	lat: number;
}

/** An event of the catalogue: what happened, where and when. */
export interface DisasterEvent {
	id: string;
	kind: DisasterKind;
	name: string;
	place: string;
	region: string;
	/** ISO 8601 with offset. */
	startedAt: string;
	rainfallMm: number;
	location: LonLat;
}

const REQUIRED_FIELDS = [
	"id",
	"kind",
	"name",
	"place",
	"region",
	"startedAt",
	"rainfallMm",
	"location",
] as const;

function assertDisasterEvent(entry: unknown): asserts entry is DisasterEvent {
	const fields = new Map(Object.entries(entry ?? {}));
	for (const field of REQUIRED_FIELDS)
		if (fields.get(field) === undefined)
			throw new Error(
				`Evento "${fields.get("id")}": falta el campo "${field}"`,
			);
	const kind = String(fields.get("kind"));
	if (!Object.hasOwn(DISASTER_KIND_LABELS, kind))
		throw new Error(`Evento "${fields.get("id")}": tipo desconocido "${kind}"`);
}

export function parseEventCatalogue(value: unknown): DisasterEvent[] {
	if (!Array.isArray(value))
		throw new Error("El catálogo de eventos debe ser una lista");
	return value.map((entry: unknown) => {
		assertDisasterEvent(entry);
		return entry;
	});
}

export const DISASTER_EVENTS = parseEventCatalogue(catalogue);
