import type { Database } from "@hack-the-andes-project/db";
import { ID_LENGTH_CHARS } from "@hack-the-andes-project/db/schema/constants";
import { gpsConnection } from "@hack-the-andes-project/db/schema/fleet";
import { sql } from "drizzle-orm";
import type { RequestLogger } from "evlog";

import { HEX_BYTE_LENGTH_CHARS, HEX_RADIX } from "./constants";
import { encryptJson } from "./crypto/index";
import { importFleetVehicles } from "./fleet/import-vehicles";
import { syncConnection } from "./fleet/sync-connection";
import { type GpsCredentialsInput, providerFor } from "./providers/index";

export async function demoEntityId(organizationId: string, entity: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(JSON.stringify([organizationId, entity])),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(HEX_RADIX).padStart(HEX_BYTE_LENGTH_CHARS, "0"),
	)
		.join("")
		.slice(0, ID_LENGTH_CHARS);
}

export interface EnsureDemoConnectionInput {
	db: Database;
	organizationId: string;
	encryptionKey: string;
	log: RequestLogger;
	connectionId?: string;
	label: string;
}

export async function ensureDemoConnection({
	db,
	organizationId,
	encryptionKey,
	log,
	connectionId,
	label,
}: EnsureDemoConnectionInput) {
	const credentials: GpsCredentialsInput = { provider: "demo" };
	const createdAt = new Date();
	const connection: typeof gpsConnection.$inferSelect = {
		id: connectionId ?? (await demoEntityId(organizationId, "connection")),
		organizationId,
		provider: "demo",
		label,
		encryptedCredentials: await encryptJson(encryptionKey, credentials),
		status: "active",
		lastSyncAt: null,
		lastError: null,
		createdAt,
		updatedAt: createdAt,
	};
	await db
		.insert(gpsConnection)
		.values(connection)
		.onDuplicateKeyUpdate({ set: { id: sql`${gpsConnection.id}` } });
	await importFleetVehicles({
		db,
		connection,
		vehicles: await providerFor("demo").listVehicles(credentials),
		vehicleIdFor: (externalId) =>
			demoEntityId(organizationId, `vehicle:${connection.id}:${externalId}`),
	});
	// The simulated fleet answers instantly, so place it on the map now
	// instead of leaving the demo idle until the next fleet-sync tick.
	await syncConnection({ db, encryptionKey, connection, now: createdAt, log });
	return connection;
}
