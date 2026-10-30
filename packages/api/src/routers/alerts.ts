import {
	ALERT_STATUSES,
	alert,
	trip,
	vehicle,
} from "@hack-the-andes-project/db/schema/fleet";
import { incident } from "@hack-the-andes-project/db/schema/scraper";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, getColumns } from "drizzle-orm";
import { z } from "zod";

import {
	ALERT_NOT_FOUND_MESSAGE,
	ALERT_NOT_OPEN_MESSAGE,
	ALERT_STATUS_ACKNOWLEDGED,
	ALERT_STATUS_OPEN,
} from "../constants";
import { organizationProcedure } from "../index";
import { alertSummarySchema, entityIdInputSchema } from "../schemas";

export const alertsRouter = {
	list: organizationProcedure
		.input(
			z
				.object({ status: z.enum(ALERT_STATUSES).default(ALERT_STATUS_OPEN) })
				.default({ status: ALERT_STATUS_OPEN }),
		)
		.output(z.array(alertSummarySchema))
		.handler(async ({ context, input }) => {
			const alerts = await context.db
				.select({
					...getColumns(alert),
					tripName: trip.name,
					vehicleName: vehicle.name,
					incident: {
						id: incident.id,
						title: incident.title,
						category: incident.category,
						geometry: incident.geometry,
						lat: incident.lat,
						lng: incident.lng,
					},
				})
				.from(alert)
				.leftJoin(
					trip,
					and(
						eq(trip.id, alert.tripId),
						eq(trip.organizationId, context.organizationId),
					),
				)
				.leftJoin(
					vehicle,
					and(
						eq(vehicle.id, alert.vehicleId),
						eq(vehicle.organizationId, context.organizationId),
					),
				)
				.leftJoin(incident, eq(incident.id, alert.incidentId))
				.where(
					and(
						eq(alert.organizationId, context.organizationId),
						eq(alert.status, input.status),
					),
				)
				.orderBy(desc(alert.createdAt), desc(alert.id));
			context.log.set({
				fleet: {
					organizationId: context.organizationId,
					alertsListed: alerts.length,
					status: input.status,
				},
			});
			return alerts;
		}),
	acknowledge: organizationProcedure
		.input(entityIdInputSchema)
		.output(
			z.object({
				id: z.string(),
				status: z.literal(ALERT_STATUS_ACKNOWLEDGED),
				acknowledgedAt: z.date().nullable(),
			}),
		)
		.handler(async ({ context, input }) => {
			await context.db
				.update(alert)
				.set({ status: ALERT_STATUS_ACKNOWLEDGED, acknowledgedAt: new Date() })
				.where(
					and(
						eq(alert.id, input.id),
						eq(alert.organizationId, context.organizationId),
						eq(alert.status, ALERT_STATUS_OPEN),
					),
				);
			const acknowledgedAlert = await context.db.query.alert.findFirst({
				columns: { id: true, status: true, acknowledgedAt: true },
				where: { id: input.id, organizationId: context.organizationId },
			});
			if (!acknowledgedAlert)
				throw new ORPCError("NOT_FOUND", { message: ALERT_NOT_FOUND_MESSAGE });
			if (acknowledgedAlert.status !== ALERT_STATUS_ACKNOWLEDGED)
				throw new ORPCError("BAD_REQUEST", { message: ALERT_NOT_OPEN_MESSAGE });
			context.log.set({
				fleet: {
					organizationId: context.organizationId,
					alertId: input.id,
					status: ALERT_STATUS_ACKNOWLEDGED,
				},
			});
			return {
				id: acknowledgedAlert.id,
				status: acknowledgedAlert.status,
				acknowledgedAt: acknowledgedAlert.acknowledgedAt,
			};
		}),
};
