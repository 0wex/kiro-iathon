import type { Database } from "@hack-the-andes-project/db";
import {
	incident,
	newsArticle,
	poi,
	scrapeRun,
} from "@hack-the-andes-project/db/schema/scraper";
import { and, eq, getTableColumns, inArray, lt, sql } from "drizzle-orm";
import type { MySqlColumn, MySqlTable } from "drizzle-orm/mysql-core";
import type { RequestLogger } from "evlog";

import { DB_WRITE_CHUNK_SIZE, MAX_RUN_ERROR_MESSAGE_CHARS } from "./constants";
import { contentHash } from "./lib/hash";
import type {
	ScrapeServices,
	ScrapeSource,
	SnapshotMode,
} from "./sources/types";

const UPSERT_PRESERVED_KEYS = new Set([
	"id",
	"source",
	"sourceId",
	"firstSeenAt",
]);

interface SyncedTable extends MySqlTable {
	id: MySqlColumn;
	source: MySqlColumn;
	sourceId: MySqlColumn;
	contentHash: MySqlColumn;
	active: MySqlColumn;
	lastSeenAt: MySqlColumn;
	lastChangedAt: MySqlColumn;
}

export interface ExistingRow {
	id: string;
	sourceId: string;
	contentHash: string;
	active: boolean;
}

interface HashedRecord<TRecord> {
	record: TRecord;
	contentHash: string;
}

export interface SyncPlan<TRecord> {
	inserts: HashedRecord<TRecord>[];
	updates: (HashedRecord<TRecord> & { id: string })[];
	unchangedIds: string[];
}

// Pure diff between what the source reported and what the table holds. Later
// duplicates of a sourceId win, an inactive row with identical content still
// counts as an update so it gets reactivated with a fresh lastChangedAt.
export async function planSync<TRecord extends { sourceId: string }>(
	existing: ExistingRow[],
	records: TRecord[],
): Promise<SyncPlan<TRecord>> {
	const existingBySourceId = new Map(
		existing.map((row) => [row.sourceId, row]),
	);
	const latestBySourceId = new Map(
		records.map((record) => [record.sourceId, record]),
	);
	const plan: SyncPlan<TRecord> = {
		inserts: [],
		updates: [],
		unchangedIds: [],
	};
	for (const record of latestBySourceId.values()) {
		const hash = await contentHash(record);
		const current = existingBySourceId.get(record.sourceId);
		if (!current) {
			plan.inserts.push({ record, contentHash: hash });
		} else if (current.contentHash === hash && current.active) {
			plan.unchangedIds.push(current.id);
		} else {
			plan.updates.push({ id: current.id, record, contentHash: hash });
		}
	}
	return plan;
}

function chunked<T>(items: T[]): T[][] {
	const chunks: T[][] = [];
	for (let start = 0; start < items.length; start += DB_WRITE_CHUNK_SIZE) {
		chunks.push(items.slice(start, start + DB_WRITE_CHUNK_SIZE));
	}
	return chunks;
}

interface SyncCounts {
	inserted: number;
	updated: number;
	deactivated: number;
}

async function loadExisting(
	db: Database,
	table: SyncedTable,
	source: string,
): Promise<ExistingRow[]> {
	const rows = await db
		.select({
			id: sql<string>`${table.id}`,
			sourceId: sql<string>`${table.sourceId}`,
			contentHash: sql<string>`${table.contentHash}`,
			active: sql<number>`${table.active}`,
		})
		.from(table)
		.where(eq(table.source, source));
	return rows.map((row) => ({ ...row, active: Boolean(row.active) }));
}

// `lastSeenAt` only ever moves forward (GREATEST): two runs of the same
// source can overlap (a manual run next to a cron fire), and a slower, older
// run writing its stamp last would otherwise make the newer run's sweep
// deactivate rows that were just confirmed present.
// New and changed rows go through one chunked upsert on the (source,
// sourceId) unique index: per-row UPDATEs cost ~45 ms each over Hyperdrive,
// which blew past the request budget on the ~1k-row SERFOR feed.
async function writePlan<TRecord extends { sourceId: string }>(
	db: Database,
	table: SyncedTable,
	source: string,
	plan: SyncPlan<TRecord>,
	runStartedAt: Date,
	snapshot: SnapshotMode,
): Promise<SyncCounts> {
	const upserts = [
		...plan.inserts.map((entry) => ({ ...entry, id: crypto.randomUUID() })),
		...plan.updates,
	].map(({ id, record, contentHash: hash }) => ({
		...record,
		id,
		source,
		contentHash: hash,
		active: true,
		firstSeenAt: runStartedAt,
		lastSeenAt: runStartedAt,
		lastChangedAt: runStartedAt,
	}));
	const columns = getTableColumns(table);
	const overwrittenKeys = Object.keys(columns).filter(
		(key) => !UPSERT_PRESERVED_KEYS.has(key),
	);
	for (const chunk of chunked(upserts)) {
		await db
			.insert(table)
			.values(chunk)
			.onDuplicateKeyUpdate({
				set: {
					...Object.fromEntries(
						overwrittenKeys.map((key) => [key, sql`values(${columns[key]})`]),
					),
					lastSeenAt: sql`greatest(${table.lastSeenAt}, values(${table.lastSeenAt}))`,
				},
			});
	}
	for (const chunk of chunked(plan.unchangedIds)) {
		await db
			.update(table)
			.set({
				lastSeenAt: sql`greatest(${table.lastSeenAt}, ${sql.param(runStartedAt, table.lastSeenAt)})`,
			})
			.where(inArray(table.id, chunk));
	}
	let deactivated = 0;
	if (snapshot === "full") {
		const [deactivation] = await db
			.update(table)
			.set({ active: false, lastChangedAt: runStartedAt })
			.where(
				and(
					eq(table.source, source),
					eq(table.active, true),
					lt(table.lastSeenAt, runStartedAt),
				),
			);
		deactivated = deactivation.affectedRows;
	}
	return {
		inserted: plan.inserts.length,
		updated: plan.updates.length,
		deactivated,
	};
}

export interface SourceRunResult extends SyncCounts {
	source: string;
	ok: boolean;
	fetched: number;
	durationMs: number;
	error?: string;
}

const PRIMARY_TABLE_BY_KIND: Record<ScrapeSource["kind"], SyncedTable> = {
	incident,
	poi,
	news: newsArticle,
};

function addCounts(left: SyncCounts, right: SyncCounts): SyncCounts {
	return {
		inserted: left.inserted + right.inserted,
		updated: left.updated + right.updated,
		deactivated: left.deactivated + right.deactivated,
	};
}

// Every timestamp written by a run is `runStartedAt`, so the deactivation
// sweep (`lastSeenAt < runStartedAt`) can never catch rows this run touched.
export async function runSource(
	db: Database,
	source: ScrapeSource,
	log: RequestLogger,
	services: ScrapeServices,
): Promise<SourceRunResult> {
	const runStartedAt = new Date();
	let result: SourceRunResult = {
		source: source.id,
		ok: false,
		fetched: 0,
		inserted: 0,
		updated: 0,
		deactivated: 0,
		durationMs: 0,
	};
	try {
		const table = PRIMARY_TABLE_BY_KIND[source.kind];
		const existing = await loadExisting(db, table, source.id);
		const context = {
			...services,
			now: runStartedAt,
			knownSourceIds: new Set(existing.map((row) => row.sourceId)),
			log,
		};
		const persist = async <TRecord extends { sourceId: string }>(
			records: TRecord[],
		) =>
			writePlan(
				db,
				table,
				source.id,
				await planSync(existing, records),
				runStartedAt,
				source.snapshot,
			);
		let fetched = 0;
		let counts: SyncCounts;
		if (source.kind === "news") {
			const records = await source.fetch(context);
			fetched = records.length;
			const derivedIncidents = records.flatMap(
				(record) => source.toIncident(record) ?? [],
			);
			const existingIncidents = await loadExisting(db, incident, source.id);
			counts = addCounts(
				await persist(records),
				await writePlan(
					db,
					incident,
					source.id,
					await planSync(existingIncidents, derivedIncidents),
					runStartedAt,
					"partial",
				),
			);
		} else if (source.kind === "poi") {
			const records = await source.fetch(context);
			fetched = records.length;
			counts = await persist(records);
		} else {
			const records = await source.fetch(context);
			fetched = records.length;
			counts = await persist(records);
		}
		result = { ...result, ...counts, ok: true, fetched };
	} catch (error) {
		result.error = (
			error instanceof Error ? error.message : String(error)
		).slice(0, MAX_RUN_ERROR_MESSAGE_CHARS);
	}
	const finishedAt = new Date();
	result.durationMs = finishedAt.getTime() - runStartedAt.getTime();
	await db.insert(scrapeRun).values({
		id: crypto.randomUUID(),
		source: source.id,
		startedAt: runStartedAt,
		finishedAt,
		ok: result.ok,
		fetched: result.fetched,
		inserted: result.inserted,
		updated: result.updated,
		deactivated: result.deactivated,
		errorMessage: result.error ?? null,
	});
	return result;
}
