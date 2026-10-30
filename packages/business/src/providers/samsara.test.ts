import { describe, expect, it, vi } from "vitest";

import { KMH_PER_MPH } from "./constants";
import { samsaraProvider } from "./samsara";

const credentials = { apiToken: "samsara-secret-token" };

describe("samsaraProvider", () => {
	it("pages through vehicles with the after cursor", async () => {
		const fetchImpl = vi.fn<typeof fetch>(async (url) => {
			const after = new URL(String(url)).searchParams.get("after");
			if (!after) {
				return Response.json({
					data: [{ id: "v1", name: "Truck 1", licensePlate: "ABC-123" }],
					pagination: { endCursor: "cursor-1", hasNextPage: true },
				});
			}
			return Response.json({
				data: [{ id: "v2", name: "Truck 2" }],
				pagination: { endCursor: "", hasNextPage: false },
			});
		});

		const vehicles = await samsaraProvider.listVehicles(credentials, fetchImpl);

		expect(vehicles).toEqual([
			{ externalId: "v1", name: "Truck 1", plate: "ABC-123" },
			{ externalId: "v2", name: "Truck 2", plate: null },
		]);
		expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
			"https://api.samsara.com/fleet/vehicles?",
			"https://api.samsara.com/fleet/vehicles?after=cursor-1",
		]);
		expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
			Authorization: "Bearer samsara-secret-token",
		});
	});

	it("converts mph to km/h and skips vehicles without gps", async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () =>
			Response.json({
				data: [
					{
						id: "v1",
						gps: {
							time: "2026-10-17T15:00:00Z",
							latitude: -12.05,
							longitude: -77.04,
							speedMilesPerHour: 50,
							headingDegrees: 90,
						},
					},
					{ id: "v2" },
				],
				pagination: { endCursor: "", hasNextPage: false },
			}),
		);

		const positions = await samsaraProvider.fetchLatestPositions(
			credentials,
			fetchImpl,
		);

		expect(positions).toEqual([
			{
				externalId: "v1",
				lat: -12.05,
				lng: -77.04,
				speedKmh: 50 * KMH_PER_MPH,
				heading: 90,
				recordedAt: new Date("2026-10-17T15:00:00Z"),
			},
		]);
		expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
			"https://api.samsara.com/fleet/vehicles/stats?types=gps",
		);
	});

	it("surfaces 401 without leaking the token", async () => {
		const fetchImpl = vi.fn<typeof fetch>(
			async () => new Response("unauthorized", { status: 401 }),
		);

		const validation = samsaraProvider.validateCredentials(
			credentials,
			fetchImpl,
		);

		await expect(validation).rejects.toThrow(
			"Samsara GET /fleet/vehicles failed with HTTP 401",
		);
		await expect(validation).rejects.not.toThrow(/samsara-secret-token/);
	});
});

it("validates the fleet permissions without requiring organization information access", async () => {
	const fetchImpl = vi.fn<typeof fetch>(async () =>
		Response.json({ data: [] }),
	);
	await samsaraProvider.validateCredentials(credentials, fetchImpl);
	expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
		"https://api.samsara.com/fleet/vehicles?limit=1",
		"https://api.samsara.com/fleet/vehicles/stats?types=gps",
	]);
});

it.each(["", "repeated-cursor"])(
	"rejects non-progressing pagination (%s)",
	async (endCursor) => {
		const fetchImpl = vi.fn<typeof fetch>(async () =>
			Response.json({ data: [], pagination: { endCursor, hasNextPage: true } }),
		);
		await expect(
			samsaraProvider.fetchLatestPositions(credentials, fetchImpl),
		).rejects.toThrow("pagination did not complete");
		expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(2);
	},
);

it("pages GPS snapshots while preserving the types filter", async () => {
	const fetchImpl = vi.fn<typeof fetch>(async (input) => {
		const url = new URL(String(input));
		expect(url.searchParams.get("types")).toBe("gps");
		return Response.json({
			data: [
				{
					id: url.searchParams.get("after") ?? "first",
					gps: {
						latitude: -12,
						longitude: -77,
						time: "2026-10-17T10:00:00-05:00",
					},
				},
			],
			pagination: {
				endCursor: "second",
				hasNextPage: !url.searchParams.has("after"),
			},
		});
	});
	const positions = await samsaraProvider.fetchLatestPositions(
		credentials,
		fetchImpl,
	);
	expect(positions.map((position) => position.externalId)).toEqual([
		"first",
		"second",
	]);
	expect(positions[0]?.recordedAt.toISOString()).toBe(
		"2026-10-17T15:00:00.000Z",
	);
});
