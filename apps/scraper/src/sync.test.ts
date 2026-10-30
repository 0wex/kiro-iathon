import { describe, expect, it } from "vitest";

import { contentHash } from "./lib/hash";
import { planSync } from "./sync";

interface Row {
	sourceId: string;
	title: string;
}

describe("planSync", () => {
	it("splits records into inserts, updates and unchanged rows", async () => {
		const sameRecord: Row = { sourceId: "a", title: "same" };
		const plan = await planSync(
			[
				{
					id: "row-a",
					sourceId: "a",
					contentHash: await contentHash(sameRecord),
					active: true,
				},
				{ id: "row-b", sourceId: "b", contentHash: "stale", active: true },
			],
			[
				sameRecord,
				{ sourceId: "b", title: "changed" },
				{ sourceId: "c", title: "new" },
			],
		);
		expect(plan.unchangedIds).toEqual(["row-a"]);
		expect(plan.updates.map((update) => update.id)).toEqual(["row-b"]);
		expect(plan.inserts.map((insert) => insert.record.sourceId)).toEqual(["c"]);
	});

	it("reactivates an inactive row even when its content did not change", async () => {
		const record: Row = { sourceId: "a", title: "same" };
		const plan = await planSync(
			[
				{
					id: "row-a",
					sourceId: "a",
					contentHash: await contentHash(record),
					active: false,
				},
			],
			[record],
		);
		expect(plan.updates.map((update) => update.id)).toEqual(["row-a"]);
		expect(plan.unchangedIds).toEqual([]);
	});

	it("keeps the last occurrence of a duplicated sourceId", async () => {
		const plan = await planSync(
			[],
			[
				{ sourceId: "a", title: "first" },
				{ sourceId: "a", title: "last" },
			],
		);
		expect(plan.inserts).toHaveLength(1);
		expect(plan.inserts[0]?.record.title).toBe("last");
	});

	it("hashes independently of key order and ignores undefined values", async () => {
		expect(await contentHash({ a: 1, b: "x", c: undefined })).toBe(
			await contentHash({ b: "x", a: 1 }),
		);
	});
});
