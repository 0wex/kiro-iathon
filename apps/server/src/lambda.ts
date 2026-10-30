import { join } from "node:path";
import { migrateDatabase } from "@iathon-kiro/db/migrate";
import { createLambdaHandler } from "@iathon-kiro/node-runtime/lambda";

import { ENV } from "./env.server";
import worker from "./index";

// Runs once per cold start, before the first request is served, so a deploy
// never answers against a schema it has not applied yet.
await migrateDatabase(
	ENV.HYPERDRIVE.connectionString,
	join(import.meta.dirname, "migrations"),
);

export const handler = createLambdaHandler({ worker });
