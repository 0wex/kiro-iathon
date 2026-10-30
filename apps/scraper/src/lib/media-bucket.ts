import { AwsClient } from "aws4fetch";

import {
	MEDIA_BUCKET_NAME,
	MEDIA_BUCKET_PUBLIC_URL,
	MEDIA_BUCKET_REGION,
	MEDIA_BUCKET_S3_ENDPOINT,
	MEDIA_CACHE_CONTROL,
	UPSTREAM_FETCH_TIMEOUT_MS,
} from "../constants";
import { UpstreamError, withQuery } from "./http";

const LISTED_KEY_PATTERN = /<Key>([^<]+)<\/Key>/g;
const CONTINUATION_TOKEN_PATTERN =
	/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/;

export interface MediaBucket {
	listKeys(prefix: string): Promise<string[]>;
	put(key: string, body: Uint8Array, contentType: string): Promise<void>;
	publicUrl(key: string): string;
}

export interface MediaBucketCredentials {
	keyId: string;
	applicationKey: string;
}

export function createMediaBucket({
	keyId,
	applicationKey,
}: MediaBucketCredentials): MediaBucket {
	const client = new AwsClient({
		accessKeyId: keyId,
		secretAccessKey: applicationKey,
		service: "s3",
		region: MEDIA_BUCKET_REGION,
	});
	const bucketUrl = `${MEDIA_BUCKET_S3_ENDPOINT}/${MEDIA_BUCKET_NAME}`;
	const send = async (url: string, init: RequestInit) => {
		const response = await client.fetch(url, {
			...init,
			signal: AbortSignal.timeout(UPSTREAM_FETCH_TIMEOUT_MS),
		});
		if (!response.ok) {
			throw new UpstreamError(url, response.status);
		}
		return response;
	};
	return {
		async listKeys(prefix) {
			const keys: string[] = [];
			let continuationToken: string | undefined;
			do {
				const listing = await send(
					withQuery(bucketUrl, {
						"list-type": 2,
						prefix,
						...(continuationToken
							? { "continuation-token": continuationToken }
							: {}),
					}),
					{},
				);
				const xml = await listing.text();
				for (const [, key] of xml.matchAll(LISTED_KEY_PATTERN)) {
					if (key) {
						keys.push(key);
					}
				}
				continuationToken = xml.match(CONTINUATION_TOKEN_PATTERN)?.[1];
			} while (continuationToken);
			return keys;
		},
		async put(key, body, contentType) {
			await send(`${bucketUrl}/${key}`, {
				method: "PUT",
				body,
				headers: {
					"content-type": contentType,
					"cache-control": MEDIA_CACHE_CONTROL,
				},
			});
		},
		publicUrl(key) {
			return `${MEDIA_BUCKET_PUBLIC_URL}/${key}`;
		},
	};
}
