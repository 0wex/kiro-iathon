import { describe, expect, it } from "vitest";
import {
	CONFIRMED_AFTER_REPORTS,
	REPORT_MAX_DELAY_S,
	REPORT_MIN_DELAY_S,
} from "../../src/dashboard/constants";
import { DISASTER_EVENTS } from "../../src/dashboard/events";
import { formatAgo, ReportFeed } from "../../src/dashboard/reports";
import { createRandom } from "../../src/map/objects/placement";

describe("ReportFeed", () => {
	it("reports every event once before repeating any", () => {
		const feed = new ReportFeed(DISASTER_EVENTS, createRandom(1));
		const firstIds = DISASTER_EVENTS.map(
			(_, index) => feed.next(index).eventId,
		);
		expect(new Set(firstIds).size).toBe(DISASTER_EVENTS.length);
		expect(feed.next(99).sequence).toBe(2);
	});

	it("numbers each event's reports and confirms it after enough of them", () => {
		const feed = new ReportFeed(DISASTER_EVENTS.slice(0, 1), createRandom(2));
		const reports = Array.from(
			{ length: CONFIRMED_AFTER_REPORTS + 1 },
			(_, index) => feed.next(index),
		);
		expect(reports.map((report) => report.sequence)).toEqual([1, 2, 3, 4]);
		expect(reports.map((report) => report.status)).toEqual([
			"reportado",
			"reportado",
			"confirmado",
			"confirmado",
		]);
		expect(reports.map((report) => report.receivedAt)).toEqual([0, 1, 2, 3]);
		expect(new Set(reports.map((report) => report.id)).size).toBe(
			reports.length,
		);
	});

	it("waits between the configured bounds before the next report", () => {
		const feed = new ReportFeed(DISASTER_EVENTS, createRandom(3));
		for (let draw = 0; draw < 100; draw++) {
			const delay = feed.nextDelayS();
			expect(delay).toBeGreaterThanOrEqual(REPORT_MIN_DELAY_S);
			expect(delay).toBeLessThanOrEqual(REPORT_MAX_DELAY_S);
		}
	});

	it("repeats the same sequence for the same seed", () => {
		const run = () => {
			const feed = new ReportFeed(DISASTER_EVENTS, createRandom(4));
			return Array.from({ length: 10 }, (_, index) => feed.next(index).eventId);
		};
		expect(run()).toEqual(run());
	});
});

describe("formatAgo", () => {
	it("says how long ago in Spanish", () => {
		expect(formatAgo(3)).toBe("hace 3 s");
		expect(formatAgo(75)).toBe("hace 1 min");
		expect(formatAgo(7_300)).toBe("hace 2 h");
	});

	it("calls a just-received report new", () => {
		expect(formatAgo(0)).toBe("ahora");
	});
});
