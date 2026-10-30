import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { relations } from "./relations";

export interface DatabaseConnectionConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
}

// Per-request connection: Hyperdrive already pools TCP connections to the
// origin at the regional edge and resets connection state between checkouts,
// so the Worker opens a fresh in-isolate connection per request instead of
// holding a pool (workerd ties a socket to the request that opened it).
// `disableEval: true` is mandatory — Workers block Function()/eval, which
// mysql2 uses to JIT-compile row parsers; without it every SELECT throws.
export async function createDb(hyperdrive: DatabaseConnectionConfig) {
	const connection = await mysql.createConnection({
		host: hyperdrive.host,
		port: hyperdrive.port,
		user: hyperdrive.user,
		password: hyperdrive.password,
		database: hyperdrive.database,
		disableEval: true,
	});
	return drizzle({ client: connection, relations });
}

export type Database = Awaited<ReturnType<typeof createDb>>;
