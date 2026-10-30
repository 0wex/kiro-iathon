import { type ZodType, z } from "zod";

import {
	KMH_PER_MPH,
	PROVIDER_MAX_PAGES_COUNT,
	PROVIDER_REQUEST_TIMEOUT_MS,
	SAMSARA_API_BASE_URL,
	SAMSARA_VALIDATION_LIMIT_ROWS,
} from "./constants";
import type { GpsProvider } from "./types";

export const samsaraCredentialsSchema = z.object({
	apiToken: z.string().min(1),
});

export type SamsaraCredentials = z.infer<typeof samsaraCredentialsSchema>;

const vehicleSchema = z.object({
	id: z.string(),
	name: z.string(),
	licensePlate: z.string().nullish(),
});

const vehicleGpsStatsSchema = z.object({
	id: z.string(),
	gps: z
		.object({
			time: z.coerce.date(),
			latitude: z.number(),
			longitude: z.number(),
			speedMilesPerHour: z.number().nullish(),
			headingDegrees: z.number().nullish(),
		})
		.nullish(),
});

async function requestSamsara(
	credentials: SamsaraCredentials,
	path: string,
	fetchImpl: typeof fetch,
): Promise<unknown> {
	const response = await fetchImpl(`${SAMSARA_API_BASE_URL}${path}`, {
		redirect: "error",
		signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
		headers: {
			Authorization: `Bearer ${credentials.apiToken}`,
			Accept: "application/json",
		},
	});
	if (!response.ok) {
		throw new Error(
			`Samsara GET ${path.split("?")[0]} failed with HTTP ${response.status}`,
		);
	}
	return response.json();
}

async function fetchAllSamsaraPages<Item>(
	credentials: SamsaraCredentials,
	path: string,
	query: Record<string, string>,
	itemSchema: ZodType<Item>,
	fetchImpl: typeof fetch,
): Promise<Item[]> {
	const pageSchema = z.object({
		data: z.array(itemSchema),
		pagination: z
			.object({ endCursor: z.string(), hasNextPage: z.boolean() })
			.optional(),
	});
	const items: Item[] = [];
	const cursors = new Set<string>();
	let cursor: string | null = null;
	do {
		const searchParams = new URLSearchParams(query);
		if (cursor) searchParams.set("after", cursor);
		const page = pageSchema.parse(
			await requestSamsara(
				credentials,
				`${path}?${searchParams.toString()}`,
				fetchImpl,
			),
		);
		items.push(...page.data);
		cursor = page.pagination?.hasNextPage ? page.pagination.endCursor : null;
		if (page.pagination?.hasNextPage) {
			if (
				!cursor ||
				cursors.has(cursor) ||
				cursors.size >= PROVIDER_MAX_PAGES_COUNT - 1
			) {
				throw new Error("Samsara pagination did not complete");
			}
			cursors.add(cursor);
		}
	} while (cursor);
	return items;
}

export const samsaraProvider: GpsProvider<SamsaraCredentials> = {
	kind: "samsara",
	credentialsSchema: samsaraCredentialsSchema,
	async validateCredentials(credentials, fetchImpl = fetch) {
		await requestSamsara(
			credentials,
			`/fleet/vehicles?limit=${SAMSARA_VALIDATION_LIMIT_ROWS}`,
			fetchImpl,
		);
		await requestSamsara(
			credentials,
			"/fleet/vehicles/stats?types=gps",
			fetchImpl,
		);
	},
	async listVehicles(credentials, fetchImpl = fetch) {
		const vehicles = await fetchAllSamsaraPages(
			credentials,
			"/fleet/vehicles",
			{},
			vehicleSchema,
			fetchImpl,
		);
		return vehicles.map((vehicle) => ({
			externalId: vehicle.id,
			name: vehicle.name,
			plate: vehicle.licensePlate || null,
		}));
	},
	async fetchLatestPositions(credentials, fetchImpl = fetch) {
		const vehicleStats = await fetchAllSamsaraPages(
			credentials,
			"/fleet/vehicles/stats",
			{ types: "gps" },
			vehicleGpsStatsSchema,
			fetchImpl,
		);
		return vehicleStats.flatMap(({ id, gps }) =>
			gps
				? [
						{
							externalId: id,
							lat: gps.latitude,
							lng: gps.longitude,
							speedKmh:
								gps.speedMilesPerHour == null
									? null
									: gps.speedMilesPerHour * KMH_PER_MPH,
							heading: gps.headingDegrees ?? null,
							recordedAt: gps.time,
						},
					]
				: [],
		);
	},
};
