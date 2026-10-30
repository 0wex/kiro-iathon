import { type ZodType, z } from "zod";

import {
	GEOTAB_API_PATH,
	GEOTAB_AUTH_ATTEMPTS_COUNT,
	GEOTAB_DEFAULT_SERVER,
	GEOTAB_SAME_SERVER_PATH,
	GEOTAB_VALIDATION_RESULTS_LIMIT,
	PROVIDER_REQUEST_TIMEOUT_MS,
} from "./constants";
import type { GpsProvider } from "./types";

const geotabServerSchema = z
	.string()
	.regex(
		/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+geotab\.com$/i,
		"Usa un servidor de Geotab, por ejemplo my.geotab.com",
	);

class GeotabSessionError extends Error {}

export const geotabCredentialsSchema = z.object({
	server: geotabServerSchema.default(GEOTAB_DEFAULT_SERVER),
	database: z.string().min(1),
	userName: z.string().min(1),
	password: z.string().min(1),
});

export type GeotabCredentials = z.infer<typeof geotabCredentialsSchema>;

const rpcEnvelopeSchema = z.object({
	result: z.unknown().optional(),
	error: z
		.object({
			name: z.string().optional(),
			data: z.object({ type: z.string().optional() }).nullish(),
		})
		.optional(),
});

const authenticateResultSchema = z.object({
	credentials: z.object({
		database: z.string(),
		userName: z.string(),
		sessionId: z.string(),
	}),
	path: z.string(),
});

const deviceSchema = z.object({
	id: z.string(),
	name: z.string(),
	licensePlate: z.string().nullish(),
});

const deviceStatusInfoSchema = z.object({
	device: z.object({ id: z.string() }),
	latitude: z.number(),
	longitude: z.number(),
	speed: z.number().nullish(),
	bearing: z.number().nullish(),
	dateTime: z.coerce.date(),
});

async function callGeotab<Result>(
	server: string,
	method: string,
	params: Record<string, unknown>,
	resultSchema: ZodType<Result>,
	fetchImpl: typeof fetch,
): Promise<Result> {
	const response = await fetchImpl(
		`https://${geotabServerSchema.parse(server)}${GEOTAB_API_PATH}`,
		{
			method: "POST",
			redirect: "error",
			signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ method, params }),
		},
	);
	if (!response.ok) {
		throw new Error(`Geotab ${method} failed with HTTP ${response.status}`);
	}
	const envelope = rpcEnvelopeSchema.parse(await response.json());
	if (envelope.error) {
		if (
			envelope.error.name === "InvalidUserException" ||
			envelope.error.data?.type === "InvalidUserException"
		) {
			throw new GeotabSessionError("Geotab session authentication failed");
		}
		throw new Error(`Geotab ${method} failed`);
	}
	return resultSchema.parse(envelope.result);
}

async function authenticateAndGet<Entity>(
	credentials: GeotabCredentials,
	typeName: string,
	entitySchema: ZodType<Entity>,
	fetchImpl: typeof fetch,
	extraParams: Record<string, unknown> = {},
): Promise<Entity[]> {
	for (let attempt = 0; attempt < GEOTAB_AUTH_ATTEMPTS_COUNT; attempt += 1) {
		const session = await callGeotab(
			credentials.server,
			"Authenticate",
			{
				database: credentials.database,
				userName: credentials.userName,
				password: credentials.password,
			},
			authenticateResultSchema,
			fetchImpl,
		);
		const sessionServer =
			session.path === GEOTAB_SAME_SERVER_PATH
				? credentials.server
				: session.path;
		try {
			return await callGeotab(
				sessionServer,
				"Get",
				{ typeName, credentials: session.credentials, ...extraParams },
				z.array(entitySchema),
				fetchImpl,
			);
		} catch (error) {
			if (
				!(error instanceof GeotabSessionError) ||
				attempt + 1 === GEOTAB_AUTH_ATTEMPTS_COUNT
			)
				throw error;
		}
	}
	throw new GeotabSessionError("Geotab session authentication failed");
}

export const geotabProvider: GpsProvider<GeotabCredentials> = {
	kind: "geotab",
	credentialsSchema: geotabCredentialsSchema,
	async validateCredentials(credentials, fetchImpl = fetch) {
		await authenticateAndGet(credentials, "Device", deviceSchema, fetchImpl, {
			resultsLimit: GEOTAB_VALIDATION_RESULTS_LIMIT,
		});
	},
	async listVehicles(credentials, fetchImpl = fetch) {
		const devices = await authenticateAndGet(
			credentials,
			"Device",
			deviceSchema,
			fetchImpl,
		);
		return devices.map((device) => ({
			externalId: device.id,
			name: device.name,
			plate: device.licensePlate || null,
		}));
	},
	async fetchLatestPositions(credentials, fetchImpl = fetch) {
		const statuses = await authenticateAndGet(
			credentials,
			"DeviceStatusInfo",
			deviceStatusInfoSchema,
			fetchImpl,
		);
		return statuses.map((status) => ({
			externalId: status.device.id,
			lat: status.latitude,
			lng: status.longitude,
			speedKmh: status.speed ?? null,
			heading: status.bearing ?? null,
			recordedAt: status.dateTime,
		}));
	},
};
