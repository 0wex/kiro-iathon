export type LooseRecord = Record<string, unknown>;

export function stringAt(record: LooseRecord, key: string): string | null {
	const value = record[key];
	if (typeof value === "number") {
		return String(value);
	}
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function numberAt(record: LooseRecord, key: string): number | null {
	const value = record[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function firstStringAt(
	record: LooseRecord,
	keys: string[],
): string | null {
	for (const key of keys) {
		const value = stringAt(record, key);
		if (value !== null) {
			return value;
		}
	}
	return null;
}
