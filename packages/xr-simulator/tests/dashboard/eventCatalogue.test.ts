import { describe, expect, it } from "vitest";
import { EVENT_GRID_RESOLUTION } from "../../src/dashboard/constants";
import {
	DISASTER_EVENTS,
	DISASTER_PRESETS,
	parseEventCatalogue,
} from "../../src/dashboard/events";
import { localCellSize } from "../../src/map/peruTerrain";

const METERS_PER_DEGREE_LAT = 110_540;
const METERS_PER_DEGREE_LON_AT_EQUATOR = 111_320;

const validEvent = {
	id: "huayco-chosica",
	kind: "huayco",
	name: "Huayco en la quebrada Quirio",
	place: "Chosica",
	region: "Lima",
	startedAt: "2026-03-15T14:20:00-05:00",
	rainfallMm: 38,
	center: { lon: -76.697, lat: -11.937 },
	release: { lon: -76.704, lat: -11.925 },
};

describe("DISASTER_EVENTS", () => {
	it("has events of every kind with unique ids", () => {
		const ids = DISASTER_EVENTS.map((event) => event.id);
		expect(new Set(ids).size).toBe(ids.length);
		const kinds = new Set(DISASTER_EVENTS.map((event) => event.kind));
		for (const kind of Object.keys(DISASTER_PRESETS))
			expect(kinds).toContain(kind);
	});

	it("releases every event inside its simulation grid", () => {
		for (const event of DISASTER_EVENTS) {
			const halfSpanMeters =
				(EVENT_GRID_RESOLUTION * localCellSize(event.center.lat)) / 2;
			const eastMeters =
				(event.release.lon - event.center.lon) *
				METERS_PER_DEGREE_LON_AT_EQUATOR *
				Math.cos((event.center.lat * Math.PI) / 180);
			const northMeters =
				(event.release.lat - event.center.lat) * METERS_PER_DEGREE_LAT;
			expect(Math.abs(eastMeters)).toBeLessThan(halfSpanMeters);
			expect(Math.abs(northMeters)).toBeLessThan(halfSpanMeters);
		}
	});
});

describe("parseEventCatalogue", () => {
	it("accepts a well-formed event", () => {
		expect(parseEventCatalogue([validEvent])).toEqual([validEvent]);
	});

	it("rejects an unknown kind, naming the event", () => {
		expect(() =>
			parseEventCatalogue([{ ...validEvent, kind: "tsunami" }]),
		).toThrow('Evento "huayco-chosica": tipo desconocido "tsunami"');
	});

	it("rejects a missing field, naming the event and the field", () => {
		const { rainfallMm: _omitted, ...withoutRainfall } = validEvent;
		expect(() => parseEventCatalogue([withoutRainfall])).toThrow(
			'Evento "huayco-chosica": falta el campo "rainfallMm"',
		);
	});

	it("rejects a catalogue that is not a list", () => {
		expect(() => parseEventCatalogue({ events: [] })).toThrow(
			"El catálogo de eventos debe ser una lista",
		);
	});
});
