import { describe, expect, it, vi } from "vitest";

import { fetchHourlyPrecipitation, summarizePrecipitation } from "./weather";

const HOUR_S = 3600;
const NOW_S = 1_760_000_400;

function series(hourlyMm: number[], firstHourS: number) {
	return {
		timesS: hourlyMm.map((_, index) => firstHourS + index * HOUR_S),
		precipitationMm: hourlyMm,
	};
}

describe("summarizePrecipitation", () => {
	// 72 h of history at 1 mm/h, then a forecast of 2 mm/h for the first day,
	// 0 for the second and 4 mm/h for the third.
	const precipitation = series(
		[
			...Array(72).fill(1),
			...Array(24).fill(2),
			...Array(24).fill(0),
			...Array(24).fill(4),
		],
		NOW_S - 72 * HOUR_S,
	);

	it("sums the last 72 h as antecedent rain", () => {
		expect(summarizePrecipitation(precipitation, NOW_S * 1000, 24)).toEqual({
			antecedentMm: 72,
			forecastMm: 48,
		});
	});

	it("uses the wettest 24 h block inside longer horizons", () => {
		expect(
			summarizePrecipitation(precipitation, NOW_S * 1000, 48).forecastMm,
		).toBe(48);
		expect(
			summarizePrecipitation(precipitation, NOW_S * 1000, 72).forecastMm,
		).toBe(96);
	});

	it("returns null when the forecast does not cover the horizon", () => {
		const shortSeries = series(Array(80).fill(1), NOW_S - 72 * HOUR_S);

		expect(
			summarizePrecipitation(shortSeries, NOW_S * 1000, 24).forecastMm,
		).toBeNull();
	});
});

describe("fetchHourlyPrecipitation", () => {
	it("requests every point at once and keeps the response order", async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () =>
			Response.json([
				{ hourly: { time: [NOW_S], precipitation: [1.5] } },
				{ hourly: { time: [NOW_S], precipitation: [null] } },
			]),
		);

		const result = await fetchHourlyPrecipitation({
			points: [
				{ lat: -11.8, lng: -76.4 },
				{ lat: -12, lng: -75.2 },
			],
			fetchImpl,
		});

		const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]));
		expect(requestUrl.searchParams.get("latitude")).toBe("-11.8,-12");
		expect(requestUrl.searchParams.get("longitude")).toBe("-76.4,-75.2");
		expect(requestUrl.searchParams.get("hourly")).toBe("precipitation");
		expect(result).toEqual([
			{ timesS: [NOW_S], precipitationMm: [1.5] },
			{ timesS: [NOW_S], precipitationMm: [null] },
		]);
	});

	it("wraps a single-location object response in an array", async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () =>
			Response.json({ hourly: { time: [NOW_S], precipitation: [0] } }),
		);

		const result = await fetchHourlyPrecipitation({
			points: [{ lat: -11.8, lng: -76.4 }],
			fetchImpl,
		});

		expect(result).toHaveLength(1);
	});

	it("retries once after a rate limit response", async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				Response.json({ error: true, reason: "limit" }, { status: 429 }),
			)
			.mockResolvedValueOnce(
				Response.json({ hourly: { time: [NOW_S], precipitation: [2] } }),
			);

		const result = await fetchHourlyPrecipitation({
			points: [{ lat: -11.8, lng: -76.4 }],
			fetchImpl,
			rateLimitRetryDelayMs: 0,
		});

		expect(fetchImpl).toHaveBeenCalledTimes(2);
		expect(result).toEqual([{ timesS: [NOW_S], precipitationMm: [2] }]);
	});

	it("rejects when the rate limit persists after the retry", async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () =>
			Response.json({ error: true, reason: "limit" }, { status: 429 }),
		);

		await expect(
			fetchHourlyPrecipitation({
				points: [{ lat: -11.8, lng: -76.4 }],
				fetchImpl,
				rateLimitRetryDelayMs: 0,
			}),
		).rejects.toThrow("HTTP 429");
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it("rejects when Open-Meteo answers with an error", async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () =>
			Response.json({ error: true, reason: "bad" }, { status: 400 }),
		);

		await expect(
			fetchHourlyPrecipitation({
				points: [{ lat: -11.8, lng: -76.4 }],
				fetchImpl,
			}),
		).rejects.toThrow("Open-Meteo");
	});
});
