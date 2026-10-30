import {
	boolean,
	double,
	index,
	json,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core";

import { mysqlTable } from "./_table";
import {
	ID_LENGTH_CHARS,
	STATUS_LENGTH_CHARS,
	TEXT_LENGTH_CHARS,
	TIMESTAMP_PRECISION_DIGITS,
} from "./constants";

export interface StoredContingencyPlanContent {
	situation: string;
	actions: string[];
	resources: string[];
	responsibles: string[];
	populationMessage: string;
}

export const citizenReport = mysqlTable(
	"citizen_report",
	{
		id: varchar("id", { length: ID_LENGTH_CHARS }).primaryKey(),
		description: text("description").notNull(),
		longitude: double("longitude").notNull(),
		latitude: double("latitude").notNull(),
		photoKey: varchar("photo_key", { length: TEXT_LENGTH_CHARS }),
		hazardKind: varchar("hazard_kind", {
			length: STATUS_LENGTH_CHARS,
		}).notNull(),
		priority: varchar("priority", { length: STATUS_LENGTH_CHARS }).notNull(),
		isExample: boolean("is_example").default(false).notNull(),
		reporterUserId: varchar("reporter_user_id", { length: ID_LENGTH_CHARS }),
		createdAt: timestamp("created_at", { fsp: TIMESTAMP_PRECISION_DIGITS })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("citizen_report_created_at_idx").on(table.createdAt)],
);

// One current plan per report: regenerating a plan overwrites this row.
export const contingencyPlan = mysqlTable("contingency_plan", {
	reportId: varchar("report_id", { length: ID_LENGTH_CHARS }).primaryKey(),
	plan: json("plan").$type<StoredContingencyPlanContent>().notNull(),
	source: varchar("source", { length: STATUS_LENGTH_CHARS }).notNull(),
	generatedAt: timestamp("generated_at", { fsp: TIMESTAMP_PRECISION_DIGITS })
		.defaultNow()
		.notNull(),
});
