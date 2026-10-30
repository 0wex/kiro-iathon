import {
	type ContentBlock,
	ConverseCommand,
	type ImageFormat,
} from "@aws-sdk/client-bedrock-runtime";
import {
	type CitizenReport,
	type ContingencyPlanContent,
	contingencyPlanContentSchema,
	type PlanSource,
	templatePlanFor,
} from "@iathon-kiro/business/citizen-reports/index";

import {
	BEDROCK_CALL_TIMEOUT_MS,
	BEDROCK_PLAN_MAX_OUTPUT_TOKENS,
	BEDROCK_PLAN_TEMPERATURE,
	BEDROCK_THROTTLING_RETRY_DELAYS_MS,
	CONTINGENCY_PLAN_TOOL_NAME,
} from "../constants";
import {
	buildPlanRequestText,
	CONTINGENCY_PLAN_SYSTEM_PROMPT,
	CONTINGENCY_PLAN_TOOL_INPUT_SCHEMA,
} from "./prompt";
import type { BedrockConverseClient } from "./services";

export interface ContingencyPlanPhoto {
	bytes: Uint8Array;
	format: ImageFormat;
}

export interface ContingencyPlanRequest {
	bedrock: BedrockConverseClient;
	modelId: string;
	report: CitizenReport;
	nearbyReports: CitizenReport[];
	photo: ContingencyPlanPhoto | null;
	timeoutMs?: number;
	retryDelaysMs?: number[];
}

export interface ContingencyPlanResult {
	content: ContingencyPlanContent;
	source: PlanSource;
	attempts: number;
	latencyMs: number;
	failureReason: string | null;
}

const INVALID_PLAN_REASON = "invalid_plan";

export async function generateContingencyPlan({
	bedrock,
	modelId,
	report,
	nearbyReports,
	photo,
	timeoutMs = BEDROCK_CALL_TIMEOUT_MS,
	retryDelaysMs = BEDROCK_THROTTLING_RETRY_DELAYS_MS,
}: ContingencyPlanRequest): Promise<ContingencyPlanResult> {
	const userContent: ContentBlock[] = [
		{ text: buildPlanRequestText(report, nearbyReports, photo !== null) },
	];
	if (photo)
		userContent.push({
			image: { format: photo.format, source: { bytes: photo.bytes } },
		});
	const command = new ConverseCommand({
		modelId,
		system: [{ text: CONTINGENCY_PLAN_SYSTEM_PROMPT }],
		messages: [{ role: "user", content: userContent }],
		inferenceConfig: {
			maxTokens: BEDROCK_PLAN_MAX_OUTPUT_TOKENS,
			temperature: BEDROCK_PLAN_TEMPERATURE,
		},
		toolConfig: {
			tools: [
				{
					toolSpec: {
						name: CONTINGENCY_PLAN_TOOL_NAME,
						description:
							"Registra el plan de contingencia para el punto crítico reportado.",
						inputSchema: { json: CONTINGENCY_PLAN_TOOL_INPUT_SCHEMA },
					},
				},
			],
			toolChoice: { tool: { name: CONTINGENCY_PLAN_TOOL_NAME } },
		},
	});
	const startedAt = performance.now();
	const templateResult = (
		attempts: number,
		failureReason: string,
	): ContingencyPlanResult => ({
		content: templatePlanFor(report.hazardKind),
		source: "plantilla",
		attempts,
		latencyMs: Math.round(performance.now() - startedAt),
		failureReason,
	});
	let attempts = 0;
	while (true) {
		attempts += 1;
		try {
			const output = await bedrock.send(command, {
				abortSignal: AbortSignal.timeout(timeoutMs),
			});
			const toolInput = output.output?.message?.content?.find(
				(block) => block.toolUse?.name === CONTINGENCY_PLAN_TOOL_NAME,
			)?.toolUse?.input;
			const parsedPlan = contingencyPlanContentSchema.safeParse(toolInput);
			if (!parsedPlan.success)
				return templateResult(attempts, INVALID_PLAN_REASON);
			return {
				content: parsedPlan.data,
				source: "bedrock",
				attempts,
				latencyMs: Math.round(performance.now() - startedAt),
				failureReason: null,
			};
		} catch (error) {
			const errorName = error instanceof Error ? error.name : "UnknownError";
			const retryDelayMs = retryDelaysMs[attempts - 1];
			if (errorName !== "ThrottlingException" || retryDelayMs === undefined)
				return templateResult(attempts, errorName);
			await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
		}
	}
}
