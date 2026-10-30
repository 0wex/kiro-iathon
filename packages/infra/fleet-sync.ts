import "varlock/auto-load";

import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";

import {
	FLEET_SYNC_CRON,
	FLEET_SYNC_DEV_PORT,
	FLEET_SYNC_WORKER_NAME,
	WORKER_OBSERVABILITY,
} from "./constants.ts";
import { hyperdriveRef } from "./hyperdrive.ts";
import { serviceVersion } from "./server.ts";

export const fleetSync = Cloudflare.Worker("fleet-sync", {
	name: FLEET_SYNC_WORKER_NAME,
	main: "../../apps/fleet-sync/src/index.ts",
	compatibility: { flags: ["nodejs_compat"] },
	observability: WORKER_OBSERVABILITY,
	crons: [FLEET_SYNC_CRON],
	env: {
		HYPERDRIVE: hyperdriveRef(),
		APP_ENV: Config.String("APP_ENV"),
		FLEET_SYNC_RUN_SECRET: Config.Redacted("FLEET_SYNC_RUN_SECRET"),
		CREDENTIALS_ENCRYPTION_KEY: Config.Redacted("CREDENTIALS_ENCRYPTION_KEY"),
		OSRM_BASE_URL: Config.String("OSRM_BASE_URL"),
		SERVICE_VERSION: serviceVersion,
	},
	dev: { port: FLEET_SYNC_DEV_PORT },
});

export interface FleetSyncEnv extends Cloudflare.InferEnv<typeof fleetSync> {}
