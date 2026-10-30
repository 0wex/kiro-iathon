import { sql } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";

export function incomingValue(column: MySqlColumn) {
	return sql`values(${sql.identifier(column.name)})`;
}
