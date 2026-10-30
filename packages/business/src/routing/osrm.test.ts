import { describe, expect, it, vi } from "vitest";

import { ROUTING_USER_AGENT } from "../constants";
import { fetchRouteCandidates } from "./osrm";

const origin = { lat: -12.05, lng: -76.88 };
const destination = { lat: -12.07, lng: -75.21 };

function fetchReturning(body: unknown): typeof fetch {
	return vi.fn(async () => new Response(JSON.stringify(body)));
}

describe("fetchRouteCandidates", () => {
	it("requests alternatives and maps every route to a candidate", async () => {
		const fetchImpl = fetchReturning({
			code: "Ok",
			routes: [
				{
					distance: 300_000,
					duration: 25_200,
					geometry: {
						type: "LineString",
						coordinates: [
							[-76.88, -12.05],
							[-75.21, -12.07],
						],
					},
				},
				{
					distance: 330_000,
					duration: 28_800,
					geometry: {
						type: "LineString",
						coordinates: [
							[-76.88, -12.05],
							[-76, -11.5],
							[-75.21, -12.07],
						],
					},
				},
			],
		});
		const candidates = await fetchRouteCandidates({
			baseUrl: "https://router.example/",
			origin,
			destination,
			fetchImpl,
		});
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://router.example/route/v1/driving/-76.88,-12.05;-75.21,-12.07?alternatives=true&overview=full&geometries=geojson&steps=false",
			expect.objectContaining({
				headers: { "User-Agent": ROUTING_USER_AGENT },
				signal: expect.any(AbortSignal),
			}),
		);
		expect(candidates).toEqual([
			{
				geometry: {
					type: "LineString",
					coordinates: [
						[-76.88, -12.05],
						[-75.21, -12.07],
					],
				},
				distanceM: 300_000,
				durationS: 25_200,
			},
			{
				geometry: {
					type: "LineString",
					coordinates: [
						[-76.88, -12.05],
						[-76, -11.5],
						[-75.21, -12.07],
					],
				},
				distanceM: 330_000,
				durationS: 28_800,
			},
		]);
	});

	it("routes through waypoints in order and allows U-turns at them", async () => {
		const fetchImpl = fetchReturning({ code: "Ok", routes: [] });
		await fetchRouteCandidates({
			baseUrl: "https://router.example",
			origin,
			destination,
			waypoints: [
				{ lat: -11.5, lng: -76.6 },
				{ lat: -11.2, lng: -76.1 },
			],
			fetchImpl,
		});
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://router.example/route/v1/driving/-76.88,-12.05;-76.6,-11.5;-76.1,-11.2;-75.21,-12.07?alternatives=true&overview=full&geometries=geojson&steps=false&continue_straight=false",
			expect.anything(),
		);
	});

	it("throws a descriptive error when OSRM does not return Ok", async () => {
		const fetchImpl = fetchReturning({
			code: "NoRoute",
			message: "Impossible route.",
		});
		await expect(
			fetchRouteCandidates({
				baseUrl: "https://router.example",
				origin,
				destination,
				fetchImpl,
			}),
		).rejects.toThrow(
			"OSRM route request failed with code NoRoute: Impossible route.",
		);
	});

	it("rejects malformed responses", async () => {
		const fetchImpl = fetchReturning({
			code: "Ok",
			routes: [{ distance: "far" }],
		});
		await expect(
			fetchRouteCandidates({
				baseUrl: "https://router.example",
				origin,
				destination,
				fetchImpl,
			}),
		).rejects.toThrow();
	});
});

it("rejects failed HTTP responses even if their body claims success", async () => {
	await expect(
		fetchRouteCandidates({
			baseUrl: "https://router.example",
			origin,
			destination,
			fetchImpl: async () =>
				Response.json({ code: "Ok", routes: [] }, { status: 503 }),
		}),
	).rejects.toThrow("HTTP 503");
});

it.each([{ coordinates: [] }, { coordinates: [[-77, -12]] }])(
	"rejects unusable route geometry (%j)",
	async ({ coordinates }) => {
		await expect(
			fetchRouteCandidates({
				baseUrl: "https://router.example",
				origin,
				destination,
				fetchImpl: fetchReturning({
					code: "Ok",
					routes: [
						{
							distance: 100,
							duration: 20,
							geometry: { type: "LineString", coordinates },
						},
					],
				}),
			}),
		).rejects.toThrow();
	},
);
