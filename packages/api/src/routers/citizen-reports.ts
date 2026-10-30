import {
	type CitizenReport,
	type ContingencyPlan,
	classifyByRules,
	compareReportsByPriority,
	createCitizenReportInputSchema,
	generatePlanInputSchema,
	HAZARD_KINDS,
	PLAN_CONTEXT_MAX_REPORTS,
	PLAN_CONTEXT_RADIUS_M,
	PLAN_SOURCES,
	REPORT_PRIORITIES,
	reportsNear,
} from "@iathon-kiro/business/citizen-reports/index";
import {
	citizenReport,
	contingencyPlan,
} from "@iathon-kiro/db/schema/citizen-report";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { generateContingencyPlan } from "../citizen-reports/planner";
import type { CitizenReportServices } from "../citizen-reports/services";
import {
	CITIZEN_REPORT_NOT_FOUND_MESSAGE,
	CITIZEN_REPORTS_UNAVAILABLE_MESSAGE,
	REPORT_PHOTO_FORMATS,
	REPORT_PHOTO_KEY_PREFIX,
} from "../constants";
import type { Context } from "../context";
import { protectedProcedure } from "../index";

const hazardKindSchema = z.enum(HAZARD_KINDS);
const prioritySchema = z.enum(REPORT_PRIORITIES);
const planSourceSchema = z.enum(PLAN_SOURCES);
const photoFormatSchema = z.enum(Object.values(REPORT_PHOTO_FORMATS));

interface StoredCitizenReport {
	report: CitizenReport;
	photoKey: string | null;
}

const citizenReportProcedure = protectedProcedure.use(({ context, next }) => {
	if (!context.citizenReports)
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: CITIZEN_REPORTS_UNAVAILABLE_MESSAGE,
		});
	return next({ context: { citizenReports: context.citizenReports } });
});

async function loadCitizenReports(
	db: Context["db"],
	photos: CitizenReportServices["photos"],
): Promise<StoredCitizenReport[]> {
	const [reportRows, planRows] = await Promise.all([
		db.query.citizenReport.findMany(),
		db.query.contingencyPlan.findMany(),
	]);
	const plansByReportId = new Map(
		planRows.map((planRow): [string, ContingencyPlan] => [
			planRow.reportId,
			{
				...planRow.plan,
				source: planSourceSchema.parse(planRow.source),
				generatedAt: planRow.generatedAt,
			},
		]),
	);
	return reportRows.map((reportRow) => ({
		photoKey: reportRow.photoKey,
		report: {
			id: reportRow.id,
			description: reportRow.description,
			location: { lon: reportRow.longitude, lat: reportRow.latitude },
			photoUrl: reportRow.photoKey ? photos.publicUrl(reportRow.photoKey) : null,
			hazardKind: hazardKindSchema.parse(reportRow.hazardKind),
			priority: prioritySchema.parse(reportRow.priority),
			isExample: reportRow.isExample,
			createdAt: reportRow.createdAt,
			plan: plansByReportId.get(reportRow.id) ?? null,
		},
	}));
}

export const citizenReportsRouter = {
	list: citizenReportProcedure.handler(async ({ context }) => {
		const storedReports = await loadCitizenReports(
			context.db,
			context.citizenReports.photos,
		);
		const reports = storedReports
			.map(({ report }) => report)
			.sort(compareReportsByPriority);
		context.log.set({ citizenReports: { listed: reports.length } });
		return reports;
	}),
	create: citizenReportProcedure
		.input(createCitizenReportInputSchema)
		.handler(async ({ context, input }) => {
			const { photos } = context.citizenReports;
			const existingReports = await loadCitizenReports(context.db, photos);
			const { hazardKind, priority } = classifyByRules(
				input,
				existingReports.map(({ report }) => report),
			);
			const reportId = crypto.randomUUID();
			const photoKey = input.photo
				? `${REPORT_PHOTO_KEY_PREFIX}${reportId}.${REPORT_PHOTO_FORMATS[input.photo.mediaType]}`
				: null;
			if (input.photo && photoKey)
				await photos.put(
					photoKey,
					Uint8Array.from(atob(input.photo.base64), (character) =>
						character.charCodeAt(0),
					),
					input.photo.mediaType,
				);
			const createdAt = new Date();
			await context.db.insert(citizenReport).values({
				id: reportId,
				description: input.description,
				longitude: input.location.lon,
				latitude: input.location.lat,
				photoKey,
				hazardKind,
				priority,
				isExample: false,
				reporterUserId: context.session.user.id,
				createdAt,
			});
			context.log.set({
				citizenReports: {
					reportId,
					hazardKind,
					priority,
					photoStored: photoKey !== null,
				},
			});
			const report: CitizenReport = {
				id: reportId,
				description: input.description,
				location: input.location,
				photoUrl: photoKey ? photos.publicUrl(photoKey) : null,
				hazardKind,
				priority,
				isExample: false,
				createdAt,
				plan: null,
			};
			return report;
		}),
	generatePlan: citizenReportProcedure
		.input(generatePlanInputSchema)
		.handler(async ({ context, input }) => {
			const { bedrock, bedrockModelId, photos } = context.citizenReports;
			const storedReports = await loadCitizenReports(context.db, photos);
			const target = storedReports.find(
				({ report }) => report.id === input.reportId,
			);
			if (!target)
				throw new ORPCError("NOT_FOUND", {
					message: CITIZEN_REPORT_NOT_FOUND_MESSAGE,
				});
			const nearbyReports = reportsNear(
				target.report,
				storedReports.map(({ report }) => report),
				PLAN_CONTEXT_RADIUS_M,
			)
				.sort(compareReportsByPriority)
				.slice(0, PLAN_CONTEXT_MAX_REPORTS);
			const photoFormat = photoFormatSchema.safeParse(
				target.photoKey?.split(".").pop(),
			);
			// A missing or unreadable photo must not block the plan: Bedrock still
			// gets the text of the report and its neighbours.
			const photoBytes =
				target.photoKey && photoFormat.success
					? await photos.read(target.photoKey).catch(() => null)
					: null;
			const planResult = await generateContingencyPlan({
				bedrock,
				modelId: bedrockModelId,
				report: target.report,
				nearbyReports,
				photo:
					photoBytes && photoFormat.success
						? { bytes: photoBytes, format: photoFormat.data }
						: null,
			});
			const generatedAt = new Date();
			await context.db
				.insert(contingencyPlan)
				.values({
					reportId: target.report.id,
					plan: planResult.content,
					source: planResult.source,
					generatedAt,
				})
				.onDuplicateKeyUpdate({
					set: {
						plan: planResult.content,
						source: planResult.source,
						generatedAt,
					},
				});
			context.log.set({
				citizenReports: {
					reportId: target.report.id,
					planSource: planResult.source,
					planFailureReason: planResult.failureReason,
					planAttempts: planResult.attempts,
					planLatencyMs: planResult.latencyMs,
					nearbyReportCount: nearbyReports.length,
					photoIncluded: photoBytes !== null,
				},
			});
			const plan: ContingencyPlan = {
				...planResult.content,
				source: planResult.source,
				generatedAt,
			};
			return plan;
		}),
};
