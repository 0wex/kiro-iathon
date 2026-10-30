import { describe, expect, it } from "vitest";

import { parseLimaDate, parseLimaDateTime } from "./dates";

describe("parseLimaDate", () => {
	it("reads DD/MM/YYYY as Lima midnight", () => {
		expect(parseLimaDate("17/10/2026")?.toISOString()).toBe(
			"2026-10-17T05:00:00.000Z",
		);
	});

	it("returns null for ISO or garbage input", () => {
		expect(parseLimaDate("2026-10-17")).toBeNull();
		expect(parseLimaDate(null)).toBeNull();
	});
});

describe("parseLimaDateTime", () => {
	it("handles 24h clocks", () => {
		expect(parseLimaDateTime("17/10/2026", "10:19:09")?.toISOString()).toBe(
			"2026-10-17T15:19:09.000Z",
		);
	});

	it("handles 12h clocks with Spanish meridiem markers", () => {
		expect(
			parseLimaDateTime("17/10/2026", "12:52:46 p.m.")?.toISOString(),
		).toBe("2026-10-17T17:52:46.000Z");
		expect(
			parseLimaDateTime("17/10/2026", "12:05:00 a.m.")?.toISOString(),
		).toBe("2026-10-17T05:05:00.000Z");
		expect(parseLimaDateTime("17/10/2026", "1:05:00 p.m.")?.toISOString()).toBe(
			"2026-10-17T18:05:00.000Z",
		);
	});
});
