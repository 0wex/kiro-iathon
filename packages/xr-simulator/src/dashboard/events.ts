import { DEFAULT_MATERIAL } from "../solver/params";
import type { MaterialParams } from "../solver/Solver";
import catalogue from "./events.json";

export type DisasterKind = "huayco" | "inundacion" | "deslizamiento";

export interface LonLat {
	lon: number;
	lat: number;
}

/** A simulated event of the catalogue: where it happens, where the flow starts and its inputs. */
export interface DisasterEvent {
	id: string;
	kind: DisasterKind;
	name: string;
	place: string;
	region: string;
	/** ISO 8601 with offset. */
	startedAt: string;
	/** Rain behind the event, shown on its card (a scenario input, not a measurement). */
	rainfallMm: number;
	/** Centre of the simulated terrain. */
	center: LonLat;
	/** Where the flow is released. */
	release: LonLat;
}

/** How each kind of event is simulated with the shallow-flow solver. */
export interface DisasterPreset {
	label: string;
	material: MaterialParams;
	volumeM3: number;
	peakDischargeM3s: number;
	releaseRadiusM: number;
	/** Simulated time recorded, past the end of the release so the flow can settle. */
	durationS: number;
}

export const DISASTER_PRESETS: Record<DisasterKind, DisasterPreset> = {
	huayco: {
		label: "Huayco",
		material: DEFAULT_MATERIAL,
		volumeM3: 120_000,
		peakDischargeM3s: 400,
		releaseRadiusM: 40,
		durationS: 900,
	},
	// Water barely resists flowing: almost no Coulomb friction and a high turbulent coefficient.
	inundacion: {
		label: "Inundación",
		material: { ...DEFAULT_MATERIAL, mu: 0.01, xi: 2_000 },
		volumeM3: 800_000,
		peakDischargeM3s: 1_500,
		releaseRadiusM: 60,
		durationS: 1_500,
	},
	// A short, massive release of a much more frictional material that stops close to its source.
	deslizamiento: {
		label: "Deslizamiento",
		material: { ...DEFAULT_MATERIAL, mu: 0.25, xi: 200 },
		volumeM3: 150_000,
		peakDischargeM3s: 1_500,
		releaseRadiusM: 60,
		durationS: 600,
	},
};

const REQUIRED_FIELDS = [
	"id",
	"kind",
	"name",
	"place",
	"region",
	"startedAt",
	"rainfallMm",
	"center",
	"release",
] as const;

function assertDisasterEvent(entry: unknown): asserts entry is DisasterEvent {
	const fields = new Map(Object.entries(entry ?? {}));
	for (const field of REQUIRED_FIELDS)
		if (fields.get(field) === undefined)
			throw new Error(`Evento "${fields.get("id")}": falta el campo "${field}"`);
	const kind = String(fields.get("kind"));
	if (!Object.hasOwn(DISASTER_PRESETS, kind))
		throw new Error(`Evento "${fields.get("id")}": tipo desconocido "${kind}"`);
}

export function parseEventCatalogue(value: unknown): DisasterEvent[] {
	if (!Array.isArray(value)) throw new Error("El catálogo de eventos debe ser una lista");
	return value.map((entry: unknown) => {
		assertDisasterEvent(entry);
		return entry;
	});
}

export const DISASTER_EVENTS = parseEventCatalogue(catalogue);
