import { describe, expect, it } from "vitest";
import { chartPolyline, formatClock } from "../../src/dashboard/chart";

describe("chartPolyline", () => {
	it("maps time to x over the whole duration and value to y from the bottom", () => {
		const points = [
			{ time: 0, value: 0 },
			{ time: 50, value: 5 },
			{ time: 100, value: 10 },
		];
		expect(chartPolyline(points, 100, 10, 200, 40)).toBe("0,40 100,20 200,0");
	});

	it("draws a flat line at the bottom while every value is zero", () => {
		const points = [
			{ time: 0, value: 0 },
			{ time: 10, value: 0 },
		];
		expect(chartPolyline(points, 20, 0, 100, 30)).toBe("0,30 50,30");
	});
});

describe("formatClock", () => {
	it("shows minutes and zero-padded seconds", () => {
		expect(formatClock(0)).toBe("0:00");
		expect(formatClock(75)).toBe("1:15");
		expect(formatClock(1500)).toBe("25:00");
	});
});
