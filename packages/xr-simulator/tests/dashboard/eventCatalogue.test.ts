import { describe, expect, it } from "vitest";
import {
	DISASTER_EVENTS,
	DISASTER_KIND_LABELS,
	parseEventCatalogue,
} from "../../src/dashboard/events";
import { PERU_BBOX } from "../../src/map/tileMath";

const validEvent = {
	id: "huayco-chosica",
	kind: "huayco",
	name: "Huayco en la quebrada Quirio",
	place: "Chosica",
	region: "Lima",
	startedAt: "2026-03-15T14:20:00-05:00",
	rainfallMm: 38,
	location: { lon: -76.7, lat: -11.93 },
};

describe("DISASTER_EVENTS", () => {
	it("has events of every kind with unique ids", () => {
		const ids = DISASTER_EVENTS.map((event) => event.id);
		expect(new Set(ids).size).toBe(ids.length);
		const kinds = new Set(DISASTER_EVENTS.map((event) => event.kind));
		for (const kind of Object.keys(DISASTER_KIND_LABELS))
			expect(kinds).toContain(kind);
	});

	it("places every event inside the area the map covers", () => {
		for (const { location } of DISASTER_EVENTS) {
			expect(location.lon).toBeGreaterThanOrEqual(PERU_BBOX.west);
			expect(location.lon).toBeLessThanOrEqual(PERU_BBOX.east);
			expect(location.lat).toBeGreaterThanOrEqual(PERU_BBOX.south);
			expect(location.lat).toBeLessThanOrEqual(PERU_BBOX.north);
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
		const { location: _omitted, ...withoutLocation } = validEvent;
		expect(() => parseEventCatalogue([withoutLocation])).toThrow(
			'Evento "huayco-chosica": falta el campo "location"',
		);
	});

	it("rejects a catalogue that is not a list", () => {
		expect(() => parseEventCatalogue({ events: [] })).toThrow(
			"El catálogo de eventos debe ser una lista",
		);
	});
});
