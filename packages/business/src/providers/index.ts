import { z } from "zod";

import { demoCredentialsSchema, demoProvider } from "./demo";
import { geotabCredentialsSchema, geotabProvider } from "./geotab";
import { samsaraCredentialsSchema, samsaraProvider } from "./samsara";
import type { GpsProvider, GpsProviderKind } from "./types";

export * from "./constants";
export * from "./demo";
export * from "./geotab";
export * from "./samsara";
export * from "./types";

export const GPS_PROVIDER_LABELS: Record<GpsProviderKind, string> = {
	geotab: "Geotab",
	samsara: "Samsara",
	demo: "Demo",
};

export const gpsCredentialsSchema = z.discriminatedUnion("provider", [
	geotabCredentialsSchema.extend({ provider: z.literal("geotab") }),
	samsaraCredentialsSchema.extend({ provider: z.literal("samsara") }),
	demoCredentialsSchema.extend({ provider: z.literal("demo") }),
]);

export type GpsCredentialsInput = z.infer<typeof gpsCredentialsSchema>;

const GPS_PROVIDER_REGISTRY: Record<GpsProviderKind, GpsProvider<unknown>> = {
	geotab: geotabProvider,
	samsara: samsaraProvider,
	demo: demoProvider,
};

export function providerFor(kind: GpsProviderKind): GpsProvider<unknown> {
	const provider = GPS_PROVIDER_REGISTRY[kind];
	if (!provider) {
		throw new Error(`Unknown GPS provider: ${kind}`);
	}
	return provider;
}
