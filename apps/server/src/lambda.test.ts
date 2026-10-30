import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	migrateDatabase: vi.fn(async () => undefined),
	lambdaHandler: vi.fn(),
	createLambdaHandler: vi.fn(),
	worker: { fetch: vi.fn() },
}));

vi.mock("./env.server", () => ({
	ENV: {
		HYPERDRIVE: {
			connectionString: "mysql://user:secret@db.internal:3306/illapa",
		},
	},
}));
vi.mock("./index", () => ({ default: mocks.worker }));
vi.mock("@iathon-kiro/db/migrate", () => ({
	migrateDatabase: mocks.migrateDatabase,
}));
vi.mock("@iathon-kiro/node-runtime/lambda", () => ({
	createLambdaHandler: mocks.createLambdaHandler.mockReturnValue(
		mocks.lambdaHandler,
	),
}));

describe("Lambda entry", () => {
	it("migrates the database on cold start, then serves the worker", async () => {
		const { handler } = await import("./lambda");

		expect(mocks.migrateDatabase).toHaveBeenCalledWith(
			"mysql://user:secret@db.internal:3306/illapa",
			join(import.meta.dirname, "migrations"),
		);
		expect(mocks.createLambdaHandler).toHaveBeenCalledWith({
			worker: mocks.worker,
		});
		expect(mocks.migrateDatabase.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.createLambdaHandler.mock.invocationCallOrder[0] ?? 0,
		);
		expect(handler).toBe(mocks.lambdaHandler);
	});
});
