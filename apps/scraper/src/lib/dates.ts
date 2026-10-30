import { HOURS_IN_HALF_DAY, LIMA_UTC_OFFSET_HOURS } from "../constants";

const DMY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const CLOCK_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i;

// Peru has no daylight saving time, so a fixed offset is exact.
function limaToUtc(
	year: number,
	monthIndex: number,
	day: number,
	hours: number,
	minutes: number,
	seconds: number,
): Date {
	return new Date(
		Date.UTC(
			year,
			monthIndex,
			day,
			hours - LIMA_UTC_OFFSET_HOURS,
			minutes,
			seconds,
		),
	);
}

// "17/10/2026" → midnight in Lima. Returns null for anything else.
export function parseLimaDate(value: string | null | undefined): Date | null {
	const match = value?.trim().match(DMY_PATTERN);
	if (!match) {
		return null;
	}
	const [, day, month, year] = match;
	return limaToUtc(Number(year), Number(month) - 1, Number(day), 0, 0, 0);
}

// "17/10/2026" + "10:19:09" or "12:52:46 p.m." → instant in Lima time.
export function parseLimaDateTime(
	dateValue: string | null | undefined,
	clockValue: string | null | undefined,
): Date | null {
	const dateMatch = dateValue?.trim().match(DMY_PATTERN);
	const clockMatch = clockValue?.trim().match(CLOCK_PATTERN);
	if (!dateMatch || !clockMatch) {
		return null;
	}
	const [, day, month, year] = dateMatch;
	const [, rawHours, minutes, seconds, meridiem] = clockMatch;
	let hours = Number(rawHours);
	if (meridiem) {
		const isAfternoon = meridiem.toLowerCase() === "p";
		if (hours === HOURS_IN_HALF_DAY) {
			hours = isAfternoon ? HOURS_IN_HALF_DAY : 0;
		} else if (isAfternoon) {
			hours += HOURS_IN_HALF_DAY;
		}
	}
	return limaToUtc(
		Number(year),
		Number(month) - 1,
		Number(day),
		hours,
		Number(minutes),
		Number(seconds ?? 0),
	);
}

export function parseIsoDate(value: unknown): Date | null {
	if (typeof value !== "string" || value.length === 0) {
		return null;
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toIsoDay(date: Date): string {
	return date.toISOString().slice(0, "YYYY-MM-DD".length);
}
