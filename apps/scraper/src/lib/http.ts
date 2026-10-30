import { UPSTREAM_FETCH_TIMEOUT_MS, UPSTREAM_USER_AGENT } from "../constants";

export class UpstreamError extends Error {
	constructor(
		readonly url: string,
		readonly status: number,
	) {
		super(`Upstream ${url} responded ${status}`);
		this.name = "UpstreamError";
	}
}

async function fetchUpstream(url: string): Promise<Response> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(UPSTREAM_FETCH_TIMEOUT_MS),
		headers: {
			accept: "application/json, text/html;q=0.9, */*;q=0.8",
			"accept-language": "es-PE,es;q=0.9",
			"user-agent": UPSTREAM_USER_AGENT,
		},
	});
	if (!response.ok) {
		throw new UpstreamError(url, response.status);
	}
	return response;
}

export async function fetchJson(url: string): Promise<unknown> {
	const response = await fetchUpstream(url);
	return response.json();
}

export async function fetchText(url: string): Promise<string> {
	const response = await fetchUpstream(url);
	return response.text();
}

export function withQuery(
	baseUrl: string,
	query: Record<string, string | number | boolean>,
): string {
	const url = new URL(baseUrl);
	for (const [key, value] of Object.entries(query)) {
		url.searchParams.set(key, String(value));
	}
	return url.toString();
}
