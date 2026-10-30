import type * as Cloudflare from "alchemy/Cloudflare";
import * as Output from "alchemy/Output";
import * as Redacted from "effect/Redacted";

import {
	HYPERDRIVE_CONFIG_ID,
	HYPERDRIVE_CONFIG_NAME,
	MYSQL_DEFAULT_PORT,
} from "./constants.ts";

// Alchemy 2.0.0-beta.83 has no read-only Hyperdrive lookup (it lands in
// beta.84 as `Cloudflare.Hyperdrive.lookup`), its Hyperdrive.Connection
// resource only manages public/Access origins, and its adopt-by-name path
// overwrites the existing config's origin. The shared config routes through a
// Workers VPC service, so we bind it by id with a value the binding classifier
// accepts (Type + hyperdriveId) and never let Alchemy manage it. Fields are
// Output literals because binding consumers (getHyperdriveDevOrigin,
// ConnectBinding) feed them into Output combinators, exactly as a real
// resource's attribute proxy would. The origin/dev fields feed `alchemy dev`,
// which dials DATABASE_URL (vero over Tailscale) directly.
export function hyperdriveRef(): Cloudflare.Hyperdrive.Connection {
	const rawDatabaseUrl = process.env.DATABASE_URL;
	if (!rawDatabaseUrl) {
		throw new Error(
			"DATABASE_URL is required for the Hyperdrive dev origin (packages/db/.env)",
		);
	}
	const databaseUrl = new URL(rawDatabaseUrl);
	const devOrigin = {
		scheme: "mysql",
		host: databaseUrl.hostname,
		port: Number(databaseUrl.port) || MYSQL_DEFAULT_PORT,
		user: decodeURIComponent(databaseUrl.username),
		database: databaseUrl.pathname.slice(1),
		password: Redacted.make(decodeURIComponent(databaseUrl.password)),
		sslmode: "prefer",
	};

	return {
		Type: "Cloudflare.Hyperdrive",
		LogicalId: "hyperdrive",
		hyperdriveId: Output.literal(HYPERDRIVE_CONFIG_ID),
		name: Output.literal(HYPERDRIVE_CONFIG_NAME),
		origin: Output.literal(devOrigin),
		dev: Output.literal(devOrigin),
		mtls: Output.literal({}),
	} as unknown as Cloudflare.Hyperdrive.Connection;
}
