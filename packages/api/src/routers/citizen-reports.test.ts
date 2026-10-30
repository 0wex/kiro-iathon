import { createRequire } from "node:module";
import type {
	ConverseCommand,
	ConverseCommandOutput,
	ToolUseBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { templatePlanFor } from "@iathon-kiro/business/citizen-reports/index";
import type {
	citizenReport,
	contingencyPlan,
} from "@iathon-kiro/db/schema/citizen-report";
import { createRouterClient } from "@orpc/server";
import type { InferSelectModel } from "drizzle-orm";
import { createRequestLogger } from "evlog";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import {
	CITIZEN_REPORT_NOT_FOUND_MESSAGE,
	CONTINGENCY_PLAN_TOOL_NAME,
} from "../constants";
import type { CitizenReportServices } from "../citizen-reports/services";
import type { Context } from "../context";
import { appRouter } from "./index";

interface QueryOptions {
	sql: string;
}
const query = vi.hoisted(() =>
	vi.fn<
		(
			options: QueryOptions,
			parameters: unknown[],
		) => Promise<[unknown, unknown[]]>
	>(),
);
const databaseRequire = createRequire(
	import.meta.resolve("@iathon-kiro/db"),
);
vi.doMock(databaseRequire.resolve("mysql2/promise"), () => ({
	default: {
		createConnection: vi.fn(async () => ({ config: {}, query, end: vi.fn() })),
	},
}));
const { createDb } = await import("@iathon-kiro/db");
const { createAuth } = await import("@iathon-kiro/auth");
const database = await createDb({
	host: "mock",
	port: Number.NaN,
	user: "mock",
	password: "mock",
	database: "mock",
});
const auth = createAuth(
	{
		BETTER_AUTH_URL: "https://api.example.com",
		BETTER_AUTH_SECRET: "test-secret-for-citizen-report-procedures",
		ALLOWED_ORIGINS: "https://app.example.com",
		CLIENT_IP_HEADER: "cf-connecting-ip",
	},
	database,
);
const createdAt = new Date("2026-10-30T10:00:00.000Z");
const session = {
	user: {
		id: "neighbour",
		name: "Vecina",
		email: "vecina@example.com",
		emailVerified: true,
		role: null,
		createdAt,
		updatedAt: createdAt,
	},
	session: {
		id: "session",
		userId: "neighbour",
		token: "session-token",
		createdAt,
		updatedAt: createdAt,
		expiresAt: new Date("2026-10-31T00:00:00.000Z"),
		activeOrganizationId: null,
	},
};

interface StoredReport extends InferSelectModel<typeof citizenReport> {}
interface StoredPlan extends InferSelectModel<typeof contingencyPlan> {}

function storedReport(overrides: Partial<StoredReport>): StoredReport {
	return {
		id: "report",
		description: "Aniego en la avenida",
		longitude: -80.64,
		latitude: -5.19,
		photoKey: null,
		hazardKind: "inundacion",
		priority: "media",
		isExample: false,
		reporterUserId: null,
		createdAt,
		...overrides,
	};
}

const validPlan = {
	situation: "Aniego que afecta viviendas.",
	actions: ["Cerrar el paso.", "Evacuar a vulnerables.", "Pedir motobombas."],
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

let storedReports: StoredReport[];
let storedPlans: StoredPlan[];
let bedrockSend: ReturnType<
	typeof vi.fn<
		(
			command: ConverseCommand,
			options?: { abortSignal?: AbortSignal },
		) => Promise<ConverseCommandOutput>
	>
>;
let photoPut: ReturnType<
	typeof vi.fn<
		(key: string, bytes: Uint8Array, contentType: string) => Promise<void>
	>
>;
let photoRead: ReturnType<typeof vi.fn<(key: string) => Promise<Uint8Array>>>;
let services: CitizenReportServices;
let log: ReturnType<typeof createRequestLogger>;

beforeEach(() => {
	query.mockReset();
	query.mockResolvedValue([{ affectedRows: 1 }, []]);
	storedReports = [];
	storedPlans = [];
	bedrockSend = vi.fn(async () => toolUseOutput(validPlan));
	photoPut = vi.fn(async () => undefined);
	photoRead = vi.fn(async () => new Uint8Array([9, 9]));
	services = {
		bedrock: { send: bedrockSend },
		bedrockModelId: "test-model",
		photos: {
			put: photoPut,
			read: photoRead,
			publicUrl: (key) => `https://photos.example.com/${key}`,
		},
	};
	log = createRequestLogger();
	vi.spyOn(database.query.citizenReport, "findMany").mockImplementation(
		vi.fn().mockImplementation(async () => storedReports),
	);
	vi.spyOn(database.query.contingencyPlan, "findMany").mockImplementation(
		vi.fn().mockImplementation(async () => storedPlans),
	);
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => database.$client.end());

function client(citizenReports: CitizenReportServices | null = services) {
	const context: Context = {
		db: database,
		auth,
		log,
		session,
		encryptionKey: "unused",
		osrmBaseUrl: "https://routing.example.com",
		waitUntil: (promise) => void promise,
		citizenReports: citizenReports ?? undefined,
	};
	return createRouterClient(appRouter, { context });
}

function insertsInto(table: string) {
	return query.mock.calls.filter(([options]) =>
		options.sql.startsWith(`insert into \`${table}\``),
	);
}

describe("citizenReports.list", () => {
	it("orders reports by priority, then newest, with their plans", async () => {
		storedReports = [
			storedReport({ id: "old-media", priority: "media" }),
			storedReport({
				id: "new-media",
				priority: "media",
				createdAt: new Date("2026-10-30T11:00:00.000Z"),
				photoKey: "citizen-reports/new-media.jpeg",
			}),
			storedReport({ id: "critica", priority: "critica" }),
			storedReport({ id: "baja", priority: "baja", hazardKind: "otro" }),
		];
		storedPlans = [
			{
				reportId: "critica",
				plan: validPlan,
				source: "bedrock",
				generatedAt: createdAt,
			},
		];

		const reports = await client().citizenReports.list();

		expect(reports.map(({ id }) => id)).toEqual([
			"critica",
			"new-media",
			"old-media",
			"baja",
		]);
		expect(reports[0]?.plan).toEqual({
			...validPlan,
			source: "bedrock",
			generatedAt: createdAt,
		});
		expect(reports[1]).toMatchObject({
			plan: null,
			photoUrl: "https://photos.example.com/citizen-reports/new-media.jpeg",
			location: { lon: -80.64, lat: -5.19 },
		});
		expect(reports[2]?.photoUrl).toBeNull();
	});

	it("rejects the call when the server has no citizen report services", async () => {
		await expect(client(null).citizenReports.list()).rejects.toMatchObject(
			{ code: "INTERNAL_SERVER_ERROR" },
		);
	});
});

describe("citizenReports.create", () => {
	it("classifies by rules against existing reports, stores the photo and returns the report", async () => {
		storedReports = [
			storedReport({
				id: "nearby",
				hazardKind: "colapso-drenaje",
				longitude: -80.6401,
				latitude: -5.1901,
			}),
		];
		const photoBytes = new Uint8Array([255, 216, 255]);

		const report = await client().citizenReports.create({
			description: "El dren de la calle está colapsado y rebalsa",
			location: { lon: -80.64, lat: -5.19 },
			photo: {
				mediaType: "image/jpeg",
				base64: btoa(String.fromCharCode(...photoBytes)),
			},
		});

		expect(report).toMatchObject({
			description: "El dren de la calle está colapsado y rebalsa",
			location: { lon: -80.64, lat: -5.19 },
			hazardKind: "colapso-drenaje",
			priority: "alta",
			isExample: false,
			plan: null,
			photoUrl: `https://photos.example.com/citizen-reports/${report.id}.jpeg`,
		});
		expect(report.createdAt).toBeInstanceOf(Date);
		expect(photoPut).toHaveBeenCalledExactlyOnceWith(
			`citizen-reports/${report.id}.jpeg`,
			photoBytes,
			"image/jpeg",
		);
		const [insert] = insertsInto("iathon_kiro_citizen_report");
		expect(insert?.[1]).toEqual(
			expect.arrayContaining([
				report.id,
				"El dren de la calle está colapsado y rebalsa",
				`citizen-reports/${report.id}.jpeg`,
				"colapso-drenaje",
				"alta",
				"neighbour",
			]),
		);
		expect(log.getContext()).toMatchObject({
			citizenReports: {
				reportId: report.id,
				hazardKind: "colapso-drenaje",
				priority: "alta",
				photoStored: true,
			},
		});
	});

	it("stores a report without a photo", async () => {
		const report = await client().citizenReports.create({
			description: "Grieta grande en el talud del cerro",
			location: { lon: -80.6, lat: -5.1 },
		});

		expect(report).toMatchObject({
			hazardKind: "deslizamiento",
			priority: "alta",
			photoUrl: null,
		});
		expect(photoPut).not.toHaveBeenCalled();
	});

	it.each([
		{
			label: "a short description",
			input: { description: "corto", location: { lon: -80.6, lat: -5.1 } },
		},
		{
			label: "a location outside Piura",
			input: {
				description: "Aniego en la avenida principal",
				location: { lon: -77.03, lat: -12.05 },
			},
		},
	])("rejects $label without storing anything", async ({ input }) => {
		await expect(client().citizenReports.create(input)).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(query).not.toHaveBeenCalled();
		expect(photoPut).not.toHaveBeenCalled();
	});
});

describe("citizenReports.generatePlan", () => {
	beforeEach(() => {
		storedReports = [
			storedReport({ id: "target", photoKey: "citizen-reports/target.png" }),
			storedReport({
				id: "nearby",
				description: "Dren colapsado cerca",
				longitude: -80.641,
				latitude: -5.191,
			}),
			storedReport({
				id: "far",
				description: "Huayco en Chulucanas",
				longitude: -80.16,
				latitude: -5.09,
			}),
		];
	});

	it("stores and returns the Bedrock plan built from the report, its photo and nearby reports", async () => {
		const plan = await client().citizenReports.generatePlan({
			reportId: "target",
		});

		expect(plan).toMatchObject({ ...validPlan, source: "bedrock" });
		expect(plan.generatedAt).toBeInstanceOf(Date);
		expect(photoRead).toHaveBeenCalledExactlyOnceWith(
			"citizen-reports/target.png",
		);
		const command = bedrockSend.mock.calls[0]?.[0];
		expect(command?.input.modelId).toBe("test-model");
		const content = command?.input.messages?.[0]?.content ?? [];
		expect(content[0]?.text).toContain("Dren colapsado cerca");
		expect(content[0]?.text).not.toContain("Huayco en Chulucanas");
		expect(content[1]?.image?.format).toBe("png");
		const [upsert] = insertsInto("iathon_kiro_contingency_plan");
		expect(upsert?.[0].sql).toContain("on duplicate key update");
		expect(upsert?.[1]).toEqual(
			expect.arrayContaining(["target", JSON.stringify(validPlan), "bedrock"]),
		);
		expect(log.getContext()).toMatchObject({
			citizenReports: {
				reportId: "target",
				planSource: "bedrock",
				planAttempts: 1,
				planFailureReason: null,
				nearbyReportCount: 1,
				photoIncluded: true,
			},
		});
	});

	it("stores the template plan when Bedrock fails", async () => {
		bedrockSend.mockRejectedValue(
			Object.assign(new Error("denied"), { name: "AccessDeniedException" }),
		);

		const plan = await client().citizenReports.generatePlan({
			reportId: "target",
		});

		expect(plan).toMatchObject({
			...templatePlanFor("inundacion"),
			source: "plantilla",
		});
		const [upsert] = insertsInto("iathon_kiro_contingency_plan");
		expect(upsert?.[1]).toEqual(
			expect.arrayContaining(["target", "plantilla"]),
		);
		expect(log.getContext()).toMatchObject({
			citizenReports: {
				planSource: "plantilla",
				planFailureReason: "AccessDeniedException",
			},
		});
	});

	it("still asks Bedrock without the photo when it cannot be read", async () => {
		photoRead.mockRejectedValue(new Error("NoSuchKey"));

		const plan = await client().citizenReports.generatePlan({
			reportId: "target",
		});

		expect(plan.source).toBe("bedrock");
		expect(
			bedrockSend.mock.calls[0]?.[0].input.messages?.[0]?.content,
		).toHaveLength(1);
		expect(log.getContext()).toMatchObject({
			citizenReports: { photoIncluded: false },
		});
	});

	it("returns NOT_FOUND for an unknown report without calling Bedrock", async () => {
		await expect(
			client().citizenReports.generatePlan({ reportId: "missing" }),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: CITIZEN_REPORT_NOT_FOUND_MESSAGE,
		});
		expect(bedrockSend).not.toHaveBeenCalled();
		expect(query).not.toHaveBeenCalled();
	});
});
