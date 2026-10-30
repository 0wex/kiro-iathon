import { createDb } from "@hack-the-andes-project/db";
import { createRequestLogger } from "evlog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateRouteReview } from "./evaluate";
import { ROUTE_REVIEW_PLACES } from "./places";

interface QueryOptions {
	sql: string;
	rowsAsArray: boolean;
}

const query = vi.hoisted(() =>
	vi.fn<
		(
			options: QueryOptions,
			parameters: unknown[],
		) => Promise<[unknown, unknown[]]>
	>(),
);

vi.mock("mysql2/promise", async (importOriginal) => ({
	...(await importOriginal<object>()),
	default: { createConnection: async () => ({ config: {}, query }) },
}));

beforeEach(() => {
	query.mockReset();
	query.mockImplementation(async () => [[], []]);
});

describe("evaluateRouteReview", () => {
	it("returns no candidates without a graph route, reads only unexpired assessments and skips detour routing", async () => {
		const db = await createDb({
			host: "test",
			port: 0,
			user: "test",
			password: "test",
			database: "test",
		});
		const now = new Date("2026-10-18T12:00:00Z");
		const fetchImpl = vi.fn<typeof fetch>();

		const review = await evaluateRouteReview({
			db,
			origin: ROUTE_REVIEW_PLACES.lima,
			destination: ROUTE_REVIEW_PLACES.huancayo,
			departureAt: now,
			axleCount: 5,
			osrmBaseUrl: "https://router.example",
			now,
			log: createRequestLogger(),
			fetchImpl,
		});

		expect(review).toEqual({
			horizons: ["now", "24h", "48h", "72h"],
			recommendedCandidateId: null,
			candidates: [],
		});
		const assessmentQuery = query.mock.calls.find(([options]) =>
			options.sql.includes("segment_risk_assessment"),
		);
		expect(assessmentQuery?.[0].sql).toMatch(/`valid_until` > \?/);
		expect(fetchImpl).not.toHaveBeenCalled();
	});
});
