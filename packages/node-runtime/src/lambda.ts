import { env } from "./cloudflare-workers";
import {
	CLOUDFRONT_VIEWER_ADDRESS_HEADER,
	VIEWER_IP_HEADER,
} from "./constants";
import { runInvocation } from "./execution-context";
import type { FetchWorker } from "./serve";

// The subset of an API Gateway HTTP API payload 2.0 event the adapter reads.
export interface HttpApiEvent {
	rawPath: string;
	rawQueryString: string;
	headers: Record<string, string | undefined>;
	cookies?: string[];
	body?: string;
	isBase64Encoded: boolean;
	requestContext: {
		domainName: string;
		http: { method: string };
	};
}

export interface HttpApiResult {
	statusCode: number;
	headers: Record<string, string>;
	cookies: string[];
	body: string;
	isBase64Encoded: boolean;
}

interface LambdaHandlerOptions {
	worker: FetchWorker;
}

function toRequest(event: HttpApiEvent): Request {
	const headers = new Headers();
	for (const [name, value] of Object.entries(event.headers)) {
		if (value !== undefined) headers.set(name, value);
	}
	if (event.cookies?.length) headers.set("cookie", event.cookies.join("; "));
	headers.delete(VIEWER_IP_HEADER);
	const viewerAddress = headers.get(CLOUDFRONT_VIEWER_ADDRESS_HEADER);
	if (viewerAddress)
		headers.set(
			VIEWER_IP_HEADER,
			viewerAddress.slice(0, viewerAddress.lastIndexOf(":")),
		);
	const { method } = event.requestContext.http;
	const host = headers.get("host") ?? event.requestContext.domainName;
	const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
	return new Request(`https://${host}${event.rawPath}${query}`, {
		method,
		headers,
		body:
			event.body === undefined || method === "GET" || method === "HEAD"
				? undefined
				: Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8"),
	});
}

// Lambda freezes the environment once the handler returns, so the response is
// only handed back after the invocation, waitUntil work and the per-request
// database connection included, has finished.
export function createLambdaHandler({ worker }: LambdaHandlerOptions) {
	return async (event: HttpApiEvent): Promise<HttpApiResult> => {
		const { result, finished } = runInvocation(
			{
				trigger: "fetch",
				method: event.requestContext.http.method,
				path: event.rawPath,
			},
			(context) => worker.fetch(toRequest(event), env, context),
		);
		try {
			const response = await result;
			const body = Buffer.from(await response.arrayBuffer());
			const headers: Record<string, string> = {};
			for (const [name, value] of response.headers) {
				if (name !== "set-cookie") headers[name] = value;
			}
			return {
				statusCode: response.status,
				headers,
				cookies: response.headers.getSetCookie(),
				body: body.toString("base64"),
				isBase64Encoded: true,
			};
		} finally {
			await finished;
		}
	};
}
