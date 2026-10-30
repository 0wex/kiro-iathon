import { z } from "zod";

import { MS_PER_SECOND } from "../constants";
import type { LatLng } from "../hazards/types";
import {
	ANTECEDENT_RAIN_WINDOW_DAYS,
	HOURS_PER_DAY,
	HTTP_TOO_MANY_REQUESTS,
	OPEN_METEO_FORECAST_DAYS,
	OPEN_METEO_FORECAST_URL,
	OPEN_METEO_RATE_LIMIT_RETRY_DELAY_MS,
	OPEN_METEO_REQUEST_TIMEOUT_MS,
	SECONDS_PER_HOUR,
} from "./constants";

const locationSchema = z.object({
	hourly: z.object({
		time: z.array(z.number()),
		precipitation: z.array(z.number().nullable()),
	}),
});

// A single location comes back as an object, several as an array.
const forecastResponseSchema = z.union([
	z.array(locationSchema),
	locationSchema.transform((location) => [location]),
]);

export interface PrecipitationSeries {
	timesS: number[];
	precipitationMm: (number | null)[];
}

export interface PrecipitationSummary {
	antecedentMm: number | null;
	forecastMm: number | null;
}

export interface FetchHourlyPrecipitationInput {
	points: LatLng[];
	baseUrl?: string;
	fetchImpl?: typeof fetch;
	rateLimitRetryDelayMs?: number;
}

export async function fetchHourlyPrecipitation({
	points,
	baseUrl = OPEN_METEO_FORECAST_URL,
	fetchImpl = fetch,
	rateLimitRetryDelayMs = OPEN_METEO_RATE_LIMIT_RETRY_DELAY_MS,
}: FetchHourlyPrecipitationInput): Promise<PrecipitationSeries[]> {
	const url = new URL(baseUrl);
	url.searchParams.set("latitude", points.map((point) => point.lat).join(","));
	url.searchParams.set("longitude", points.map((point) => point.lng).join(","));
	url.searchParams.set("hourly", "precipitation");
	url.searchParams.set("past_days", String(ANTECEDENT_RAIN_WINDOW_DAYS));
	url.searchParams.set("forecast_days", String(OPEN_METEO_FORECAST_DAYS));
	url.searchParams.set("timeformat", "unixtime");
	url.searchParams.set("timezone", "GMT");

	const request = () =>
		fetchImpl(url, {
			signal: AbortSignal.timeout(OPEN_METEO_REQUEST_TIMEOUT_MS),
		});
	let response = await request();
	// Open-Meteo bills every location as one call against a per-minute quota,
	// so a manual run right next to the hourly cron can trip it; the window
	// resets within a minute.
	if (response.status === HTTP_TOO_MANY_REQUESTS) {
		await new Promise((resolve) => setTimeout(resolve, rateLimitRetryDelayMs));
		response = await request();
	}
	if (!response.ok) {
		throw new Error(`Open-Meteo forecast failed with HTTP ${response.status}`);
	}
	const locations = forecastResponseSchema.parse(await response.json());
	return locations.map((location) => ({
		timesS: location.hourly.time,
		precipitationMm: location.hourly.precipitation,
	}));
}

function sumBetween(
	series: PrecipitationSeries,
	startS: number,
	endS: number,
): { totalMm: number; hours: number } {
	let totalMm = 0;
	let hours = 0;
	series.timesS.forEach((timeS, index) => {
		if (timeS >= startS && timeS < endS) {
			totalMm += series.precipitationMm[index] ?? 0;
			hours += 1;
		}
	});
	return { totalMm, hours };
}

// Antecedent rain is the observed/analysed total of the last 72 h; the
// forecast value is the wettest 24 h block inside the horizon, null when the
// series does not cover it.
export function summarizePrecipitation(
	series: PrecipitationSeries,
	nowMs: number,
	horizonHours: number,
): PrecipitationSummary {
	const nowS = Math.floor(nowMs / MS_PER_SECOND);
	const antecedent = sumBetween(
		series,
		nowS - ANTECEDENT_RAIN_WINDOW_DAYS * HOURS_PER_DAY * SECONDS_PER_HOUR,
		nowS,
	);

	let forecastMm: number | null = 0;
	for (
		let blockStartHours = 0;
		blockStartHours < horizonHours;
		blockStartHours += HOURS_PER_DAY
	) {
		const block = sumBetween(
			series,
			nowS + blockStartHours * SECONDS_PER_HOUR,
			nowS + (blockStartHours + HOURS_PER_DAY) * SECONDS_PER_HOUR,
		);
		if (block.hours < HOURS_PER_DAY) {
			forecastMm = null;
			break;
		}
		forecastMm = Math.max(forecastMm, block.totalMm);
	}

	return {
		antecedentMm: antecedent.hours > 0 ? antecedent.totalMm : null,
		forecastMm,
	};
}
