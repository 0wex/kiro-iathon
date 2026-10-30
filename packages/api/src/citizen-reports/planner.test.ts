import type {
	ConverseCommand,
	ConverseCommandOutput,
	ToolUseBlock,
} from "@aws-sdk/client-bedrock-runtime";
import {
	type CitizenReport,
	templatePlanFor,
} from "@iathon-kiro/business/citizen-reports/index";
import { describe, expect, it, vi } from "vitest";

import {
	BEDROCK_CALL_TIMEOUT_MS,
	BEDROCK_PLAN_DEADLINE_MS,
	BEDROCK_THROTTLING_RETRY_DELAYS_MS,
	CONTINGENCY_PLAN_TOOL_NAME,
} from "../constants";
import { generateContingencyPlan } from "./planner";

const report: CitizenReport = {
	id: "report-1",
	description: "Aniego en la Av. Sánchez Cerro, el agua entra a las casas",
	location: { lon: -80.64, lat: -5.19 },
	photoUrl: null,
	hazardKind: "inundacion",
	priority: "media",
	isExample: false,
	createdAt: new Date("2026-10-30T10:00:00Z"),
	plan: null,
};

const nearbyReport: CitizenReport = {
	...report,
	id: "report-2",
	description: "Dren colapsado a dos cuadras",
	location: { lon: -80.641, lat: -5.191 },
	hazardKind: "colapso-drenaje",
};

const bedrockPlan = {
	situation: "Aniego que afecta viviendas en la Av. Sánchez Cerro.",
	actions: [
		"Cerrar el paso vehicular.",
		"Evacuar a personas vulnerables.",
		"Solicitar motobombas a la municipalidad.",
	],
	resources: ["Motobomba"],
	responsibles: ["COER Piura"],
	populationMessage: "Evite cruzar calles inundadas.",
};

function toolUseOutput(input: ToolUseBlock["input"]): ConverseCommandOutput {
	return {
		$metadata: {},
		output: {
			message: {
				role: "assistant",
				content: [
					{
						toolUse: {
							toolUseId: "tool-1",
							name: CONTINGENCY_PLAN_TOOL_NAME,
							input,
						},
					},
				],
			},
		},
		stopReason: "tool_use",
		usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
		metrics: { latencyMs: 1 },
	};
}

function namedError(name: string) {
	const error = new Error(name);
	error.name = name;
	return error;
}

function bedrockClient(
	send: (
		command: ConverseCommand,
		options?: { abortSignal?: AbortSignal },
	) => Promise<ConverseCommandOutput>,
) {
	return { send: vi.fn(send) };
}

const noDelays = BEDROCK_THROTTLING_RETRY_DELAYS_MS.map(() => 0);

describe("contingency planner", () => {
	it("returns the Bedrock plan with the designed prompt, photo and nearby reports", async () => {
		const bedrock = bedrockClient(async () => toolUseOutput(bedrockPlan));
		const photoBytes = new Uint8Array([1, 2, 3]);

		const result = await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [nearbyReport],
			photo: { bytes: photoBytes, format: "jpeg" },
		});

		expect(result).toMatchObject({
			content: bedrockPlan,
			source: "bedrock",
			attempts: 1,
			failureReason: null,
		});
		expect(bedrock.send).toHaveBeenCalledOnce();
		const [command, options] = bedrock.send.mock.calls[0] ?? [];
		expect(options?.abortSignal).toBeInstanceOf(AbortSignal);
		const commandInput = command?.input;
		expect(commandInput?.modelId).toBe("model-id");
		expect(commandInput?.system?.[0]?.text).toContain("COER Piura");
		expect(commandInput?.system?.[0]?.text).toContain(
			"No inventes declaratorias de emergencia",
		);
		expect(commandInput?.toolConfig?.toolChoice).toEqual({
			tool: { name: CONTINGENCY_PLAN_TOOL_NAME },
		});
		expect(commandInput?.toolConfig?.tools?.[0]?.toolSpec?.name).toBe(
			CONTINGENCY_PLAN_TOOL_NAME,
		);
		const content = commandInput?.messages?.[0]?.content ?? [];
		expect(content[0]?.text).toContain(report.description);
		expect(content[0]?.text).toContain(nearbyReport.description);
		expect(content[1]?.image).toEqual({
			format: "jpeg",
			source: { bytes: photoBytes },
		});
	});

	it("sends only text when the report has no photo", async () => {
		const bedrock = bedrockClient(async () => toolUseOutput(bedrockPlan));

		await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [],
			photo: null,
		});

		const content = bedrock.send.mock.calls[0]?.[0].input.messages?.[0]?.content;
		expect(content).toHaveLength(1);
		expect(content?.[0]?.text).toContain("No hay otros reportes cerca.");
	});

	it("retries ThrottlingException twice before succeeding", async () => {
		const bedrock = bedrockClient(async () => toolUseOutput(bedrockPlan));
		bedrock.send
			.mockRejectedValueOnce(namedError("ThrottlingException"))
			.mockRejectedValueOnce(namedError("ThrottlingException"));

		const result = await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [],
			photo: null,
			retryDelaysMs: noDelays,
		});

		expect(result).toMatchObject({ source: "bedrock", attempts: 3 });
		expect(bedrock.send).toHaveBeenCalledTimes(3);
	});

	it("falls back to the template after three throttled attempts", async () => {
		const bedrock = bedrockClient(async () => {
			throw namedError("ThrottlingException");
		});

		const result = await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [],
			photo: null,
			retryDelaysMs: noDelays,
		});

		expect(result).toMatchObject({
			content: templatePlanFor("inundacion"),
			source: "plantilla",
			attempts: 3,
			failureReason: "ThrottlingException",
		});
	});

	it("does not retry other errors and returns the template plan", async () => {
		const bedrock = bedrockClient(async () => {
			throw namedError("AccessDeniedException");
		});

		const result = await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [],
			photo: null,
			retryDelaysMs: noDelays,
		});

		expect(bedrock.send).toHaveBeenCalledOnce();
		expect(result).toMatchObject({
			content: templatePlanFor("inundacion"),
			source: "plantilla",
			attempts: 1,
			failureReason: "AccessDeniedException",
		});
	});

	it("aborts a call that outlives the timeout and returns the template plan", async () => {
		const bedrock = bedrockClient(
			(_command, options) =>
				new Promise((_resolve, reject) => {
					options?.abortSignal?.addEventListener("abort", () =>
						reject(namedError("AbortError")),
					);
				}),
		);

		const result = await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [],
			photo: null,
			timeoutMs: 5,
		});

		expect(bedrock.send).toHaveBeenCalledOnce();
		expect(result).toMatchObject({
			content: templatePlanFor("inundacion"),
			source: "plantilla",
			failureReason: "AbortError",
		});
	});

	it.each([
		{ label: "too few actions", input: { ...bedrockPlan, actions: ["Uno"] } },
		{ label: "a missing field", input: { situation: "Solo resumen" } },
		{
			label: "an oversized population message",
			input: { ...bedrockPlan, populationMessage: "a".repeat(281) },
		},
	])("returns the template plan when the tool input has $label", async ({
		input,
	}) => {
		const bedrock = bedrockClient(async () => toolUseOutput(input));

		const result = await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [],
			photo: null,
		});

		expect(result).toMatchObject({
			content: templatePlanFor("inundacion"),
			source: "plantilla",
			failureReason: "invalid_plan",
		});
	});

	it("returns the template plan when Bedrock answers without the tool", async () => {
		const bedrock = bedrockClient(async () => ({
			$metadata: {},
			output: {
				message: { role: "assistant", content: [{ text: "Hola" }] },
			},
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
			metrics: { latencyMs: 1 },
		}));

		const result = await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [],
			photo: null,
		});

		expect(result).toMatchObject({
			source: "plantilla",
			failureReason: "invalid_plan",
		});
	});

	it("caps a call at the time left before the overall deadline", async () => {
		const bedrock = bedrockClient(
			(_command, options) =>
				new Promise((_resolve, reject) => {
					options?.abortSignal?.addEventListener("abort", () =>
						reject(namedError("AbortError")),
					);
				}),
		);
		const startedAt = performance.now();

		const result = await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [],
			photo: null,
			timeoutMs: 5_000,
			deadlineMs: 20,
		});

		expect(performance.now() - startedAt).toBeLessThan(1_000);
		expect(bedrock.send).toHaveBeenCalledOnce();
		expect(result).toMatchObject({
			content: templatePlanFor("inundacion"),
			source: "plantilla",
			attempts: 1,
			failureReason: "AbortError",
		});
	});

	it("stops retrying throttled calls once the overall deadline would pass", async () => {
		const bedrock = bedrockClient(async () => {
			throw namedError("ThrottlingException");
		});
		const startedAt = performance.now();

		const result = await generateContingencyPlan({
			bedrock,
			modelId: "model-id",
			report,
			nearbyReports: [],
			photo: null,
			retryDelaysMs: [5_000, 5_000],
			deadlineMs: 50,
		});

		expect(performance.now() - startedAt).toBeLessThan(1_000);
		expect(bedrock.send).toHaveBeenCalledOnce();
		expect(result).toMatchObject({
			content: templatePlanFor("inundacion"),
			source: "plantilla",
			attempts: 1,
			failureReason: "deadline_exceeded",
		});
	});

	it("uses the designed timeout, backoff and deadline by default", () => {
		expect(BEDROCK_CALL_TIMEOUT_MS).toBe(20_000);
		expect(BEDROCK_THROTTLING_RETRY_DELAYS_MS).toEqual([500, 1000]);
		expect(BEDROCK_PLAN_DEADLINE_MS).toBe(25_000);
	});
});
