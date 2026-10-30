import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { HttpApiEvent } from "./lambda";

const evlog = vi.hoisted(() => {
	const logger = { error: vi.fn(), emit: vi.fn() };
	return { logger, createLogger: vi.fn(() => logger) };
});
vi.mock("evlog", () => ({ createLogger: evlog.createLogger }));

beforeAll(() => {
	vi.stubEnv("DATABASE_URL", "mysql://user:secret@db.internal:3306/fierros");
});

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});

function httpApiEvent(overrides: Partial<HttpApiEvent> = {}): HttpApiEvent {
	return {
		rawPath: "/rpc/citizenReports/create",
		rawQueryString: "batch=1",
		headers: {
			host: "abc123.execute-api.us-east-1.amazonaws.com",
			"content-type": "application/json",
			"cloudfront-viewer-address": "198.51.100.10:46532",
		},
		cookies: ["session=one", "theme=dark"],
		body: JSON.stringify({ description: "Aniego" }),
		isBase64Encoded: false,
		requestContext: {
			domainName: "abc123.execute-api.us-east-1.amazonaws.com",
			http: { method: "POST" },
		},
		...overrides,
	};
}

describe("HTTP API Lambda handler", () => {
	it("hands the worker the request with its path, query, method, headers, cookies, body and the viewer IP", async () => {
		const { createLambdaHandler } = await import("./lambda");
		const { env } = await import("./cloudflare-workers");
		const fetch = vi.fn(
			async (_request: Request, _env: unknown) => new Response("ok"),
		);
		const handler = createLambdaHandler({ worker: { fetch } });

		await handler(httpApiEvent());

		const [request, workerEnv] = fetch.mock.calls[0] ?? [];
		if (!(request instanceof Request)) throw new Error("No request");
		expect(workerEnv).toBe(env);
		expect(request.method).toBe("POST");
		expect(request.url).toBe(
			"https://abc123.execute-api.us-east-1.amazonaws.com/rpc/citizenReports/create?batch=1",
		);
		expect(request.headers.get("content-type")).toBe("application/json");
		expect(request.headers.get("cookie")).toBe("session=one; theme=dark");
		expect(request.headers.get("x-viewer-ip")).toBe("198.51.100.10");
		expect(await request.json()).toEqual({ description: "Aniego" });
	});

	it("drops a client-sent viewer IP header when CloudFront did not set one", async () => {
		const { createLambdaHandler } = await import("./lambda");
		const fetch = vi.fn(async (_request: Request) => new Response("ok"));
		const handler = createLambdaHandler({ worker: { fetch } });

		await handler(
			httpApiEvent({
				headers: { host: "api.example.com", "x-viewer-ip": "203.0.113.9" },
				cookies: undefined,
			}),
		);

		const request = fetch.mock.calls[0]?.[0];
		expect(request?.headers.get("x-viewer-ip")).toBeNull();
		expect(request?.headers.get("cookie")).toBeNull();
	});

	it("keeps the IPv6 viewer address without its port", async () => {
		const { createLambdaHandler } = await import("./lambda");
		const fetch = vi.fn(async (_request: Request) => new Response("ok"));
		const handler = createLambdaHandler({ worker: { fetch } });

		await handler(
			httpApiEvent({
				headers: { "cloudfront-viewer-address": "2001:db8::1:443" },
			}),
		);

		expect(fetch.mock.calls[0]?.[0].headers.get("x-viewer-ip")).toBe(
			"2001:db8::1",
		);
	});

	it("decodes a base64 request body and sends no body on GET", async () => {
		const { createLambdaHandler } = await import("./lambda");
		const fetch = vi.fn(async (_request: Request) => new Response("ok"));
		const handler = createLambdaHandler({ worker: { fetch } });

		await handler(
			httpApiEvent({
				body: Buffer.from("binary-photo").toString("base64"),
				isBase64Encoded: true,
			}),
		);
		await handler(
			httpApiEvent({
				body: undefined,
				requestContext: {
					domainName: "api.example.com",
					http: { method: "GET" },
				},
			}),
		);

		expect(await fetch.mock.calls[0]?.[0].text()).toBe("binary-photo");
		expect(fetch.mock.calls[1]?.[0].body).toBeNull();
	});

	it("returns status, headers, cookies and a base64 body, after every waitUntil promise settled", async () => {
		const { createLambdaHandler } = await import("./lambda");
		const settledSteps: string[] = [];
		const backgroundWork = Promise.withResolvers<void>();
		const handler = createLambdaHandler({
			worker: {
				fetch(_request, _env, context) {
					context.waitUntil(
						backgroundWork.promise.then(() => {
							settledSteps.push("background work");
						}),
					);
					const headers = new Headers({ "content-type": "application/json" });
					headers.append("set-cookie", "session=two; HttpOnly");
					headers.append("set-cookie", "theme=light");
					return new Response('{"saved":true}', { status: 201, headers });
				},
			},
		});

		const pendingResult = handler(httpApiEvent()).then((result) => {
			settledSteps.push("returned");
			return result;
		});
		await Promise.resolve();
		backgroundWork.resolve();
		const result = await pendingResult;

		expect(settledSteps).toEqual(["background work", "returned"]);
		expect(result).toEqual({
			statusCode: 201,
			headers: { "content-type": "application/json" },
			cookies: ["session=two; HttpOnly", "theme=light"],
			body: Buffer.from('{"saved":true}').toString("base64"),
			isBase64Encoded: true,
		});
	});
});
