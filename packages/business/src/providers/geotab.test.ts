import { describe, expect, it, vi } from "vitest";

import { geotabCredentialsSchema, geotabProvider } from "./geotab";

const credentials = geotabCredentialsSchema.parse({
	database: "fleet_db",
	userName: "ops@example.com",
	password: "hunter2",
});

const sessionCredentials = {
	database: "fleet_db",
	userName: "ops@example.com",
	sessionId: "session-123",
};

function mockGeotab(path: string, getResult: unknown) {
	return vi.fn<typeof fetch>(async (_url, init) => {
		const body = JSON.parse(String(init?.body));
		if (body.method === "Authenticate") {
			return Response.json({
				result: { credentials: sessionCredentials, path },
			});
		}
		return Response.json({ result: getResult });
	});
}

describe("geotabProvider", () => {
	it("authenticates then maps Device results to vehicles", async () => {
		const fetchImpl = mockGeotab("ThisServer", [
			{ id: "b1", name: "Truck 1", licensePlate: "ABC-123" },
			{ id: "b2", name: "Truck 2", licensePlate: "" },
		]);

		const vehicles = await geotabProvider.listVehicles(credentials, fetchImpl);

		expect(vehicles).toEqual([
			{ externalId: "b1", name: "Truck 1", plate: "ABC-123" },
			{ externalId: "b2", name: "Truck 2", plate: null },
		]);
		const [authenticateCall, getCall] = fetchImpl.mock.calls;
		expect(authenticateCall?.[0]).toBe("https://my.geotab.com/apiv1");
		expect(JSON.parse(String(authenticateCall?.[1]?.body))).toEqual({
			method: "Authenticate",
			params: {
				database: "fleet_db",
				userName: "ops@example.com",
				password: "hunter2",
			},
		});
		expect(getCall?.[0]).toBe("https://my.geotab.com/apiv1");
		expect(JSON.parse(String(getCall?.[1]?.body))).toEqual({
			method: "Get",
			params: { typeName: "Device", credentials: sessionCredentials },
		});
	});

	it("follows the server path returned by Authenticate", async () => {
		const fetchImpl = mockGeotab("my42.geotab.com", []);

		await geotabProvider.listVehicles(credentials, fetchImpl);

		expect(fetchImpl.mock.calls[1]?.[0]).toBe("https://my42.geotab.com/apiv1");
	});

	it("maps DeviceStatusInfo results to positions", async () => {
		const fetchImpl = mockGeotab("ThisServer", [
			{
				device: { id: "b1" },
				latitude: -12.05,
				longitude: -77.04,
				speed: 62,
				bearing: 180,
				dateTime: "2026-10-17T15:00:00.000Z",
			},
		]);

		const positions = await geotabProvider.fetchLatestPositions(
			credentials,
			fetchImpl,
		);

		expect(positions).toEqual([
			{
				externalId: "b1",
				lat: -12.05,
				lng: -77.04,
				speedKmh: 62,
				heading: 180,
				recordedAt: new Date("2026-10-17T15:00:00.000Z"),
			},
		]);
		expect(
			JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body)).params.typeName,
		).toBe("DeviceStatusInfo");
	});

	it("surfaces JSON-RPC errors without leaking the password", async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () =>
			Response.json({
				error: {
					name: "InvalidUserException",
					message: "Incorrect password hunter2",
				},
			}),
		);

		const validation = geotabProvider.validateCredentials(
			credentials,
			fetchImpl,
		);

		await expect(validation).rejects.toThrow(
			"Geotab session authentication failed",
		);
		await expect(validation).rejects.not.toThrow(/hunter2/);
	});

	it("surfaces non-2xx HTTP statuses", async () => {
		const fetchImpl = vi.fn<typeof fetch>(
			async () => new Response("", { status: 503 }),
		);

		await expect(
			geotabProvider.listVehicles(credentials, fetchImpl),
		).rejects.toThrow("Geotab Authenticate failed with HTTP 503");
	});
});

it.each([
	"127.0.0.1",
	"my.geotab.com@attacker.test",
	"my.geotab.com/redirect",
	"my.geotab.com.attacker.test",
])("rejects untrusted credential destinations: %s", async (server) => {
	const fetchImpl = vi.fn<typeof fetch>();
	await expect(
		geotabProvider.listVehicles({ ...credentials, server }, fetchImpl),
	).rejects.toThrow();
	expect(fetchImpl).not.toHaveBeenCalled();
});

it("does not forward session credentials to an untrusted federation path", async () => {
	const fetchImpl = mockGeotab("attacker.test", []);
	await expect(
		geotabProvider.listVehicles(credentials, fetchImpl),
	).rejects.toThrow();
	expect(fetchImpl).toHaveBeenCalledTimes(1);
	expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe("error");
});

it.each([false, true])(
	"re-authenticates once on expired sessions and bounds retries (persistent: %s)",
	async (persistent) => {
		let gets = 0;
		const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
			const body = JSON.parse(String(init?.body));
			if (body.method === "Authenticate")
				return Response.json({
					result: { credentials: sessionCredentials, path: "my42.geotab.com" },
				});
			gets += 1;
			return gets === 1 || persistent
				? Response.json({
						error: {
							message: "expired hunter2",
							data: { type: "InvalidUserException" },
						},
					})
				: Response.json({ result: [] });
		});
		const result = geotabProvider.listVehicles(credentials, fetchImpl);
		if (persistent)
			await expect(result).rejects.toThrow(
				"Geotab session authentication failed",
			);
		else await expect(result).resolves.toEqual([]);
		expect(fetchImpl).toHaveBeenCalledTimes(4);
	},
);
