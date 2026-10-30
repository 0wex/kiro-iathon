import { describe, expect, it } from "vitest";

import { demoProvider } from "./demo";
import { geotabProvider } from "./geotab";
import { gpsCredentialsSchema, providerFor } from "./index";
import { samsaraProvider } from "./samsara";
import type { GpsProviderKind } from "./types";

describe("providerFor", () => {
	it("returns the adapter for each kind", () => {
		expect(providerFor("geotab")).toBe(geotabProvider);
		expect(providerFor("samsara")).toBe(samsaraProvider);
		expect(providerFor("demo")).toBe(demoProvider);
	});

	it("throws for an unknown kind", () => {
		const unknownKind = JSON.parse('"verizon"') satisfies GpsProviderKind;
		expect(() => providerFor(unknownKind)).toThrow(
			"Unknown GPS provider: verizon",
		);
	});
});

describe("gpsCredentialsSchema", () => {
	it("discriminates by provider and applies the Geotab server default", () => {
		expect(
			gpsCredentialsSchema.parse({
				provider: "geotab",
				database: "fleet_db",
				userName: "ops",
				password: "secret",
			}),
		).toMatchObject({ provider: "geotab", server: "my.geotab.com" });
		expect(() => gpsCredentialsSchema.parse({ provider: "samsara" })).toThrow();
		expect(gpsCredentialsSchema.parse({ provider: "demo" })).toEqual({
			provider: "demo",
		});
	});
});
