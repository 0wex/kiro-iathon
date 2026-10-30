import {
	BedrockRuntimeClient,
	type ConverseCommand,
	type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

export interface BedrockConverseClient {
	send(
		command: ConverseCommand,
		options?: { abortSignal?: AbortSignal },
	): Promise<ConverseCommandOutput>;
}

export interface ReportPhotoStore {
	put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
	read(key: string): Promise<Uint8Array>;
	publicUrl(key: string): string;
}

export interface CitizenReportServices {
	bedrock: BedrockConverseClient;
	bedrockModelId: string;
	photos: ReportPhotoStore;
}

export interface CitizenReportServicesConfig {
	bedrockRegion: string;
	bedrockModelId: string;
	photosBucket: string;
	photosRegion: string;
}

// Both clients use the AWS SDK default credential chain, so in AWS they
// authenticate with the compute's IAM role and no keys live in the env.
export function createCitizenReportServices(
	config: CitizenReportServicesConfig,
): CitizenReportServices {
	const s3 = new S3Client({ region: config.photosRegion });
	return {
		bedrock: new BedrockRuntimeClient({ region: config.bedrockRegion }),
		bedrockModelId: config.bedrockModelId,
		photos: {
			async put(key, bytes, contentType) {
				await s3.send(
					new PutObjectCommand({
						Bucket: config.photosBucket,
						Key: key,
						Body: bytes,
						ContentType: contentType,
					}),
				);
			},
			async read(key) {
				const object = await s3.send(
					new GetObjectCommand({ Bucket: config.photosBucket, Key: key }),
				);
				if (!object.Body) throw new Error(`Empty S3 object ${key}`);
				return object.Body.transformToByteArray();
			},
			// The bucket policy grants public read on the report photo prefix only,
			// so the browser loads photos straight from S3.
			publicUrl(key) {
				return `https://${config.photosBucket}.s3.${config.photosRegion}.amazonaws.com/${key}`;
			},
		},
	};
}
