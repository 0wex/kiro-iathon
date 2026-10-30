import { encryptJson } from "@hack-the-andes-project/business/crypto/index";
import { isDemoAccountEmail } from "@hack-the-andes-project/business/demo-account";
import { ensureDemoConnection } from "@hack-the-andes-project/business/demo-fleet";
import { importFleetVehicles } from "@hack-the-andes-project/business/fleet/import-vehicles";
import { resolveObsoleteAlerts } from "@hack-the-andes-project/business/fleet/resolve-obsolete-alerts";
import {
	gpsCredentialsSchema,
	providerFor,
} from "@hack-the-andes-project/business/providers/index";
import type { Database } from "@hack-the-andes-project/db";
import {
	gpsConnection,
	trip,
	vehicle,
	vehiclePosition,
} from "@hack-the-andes-project/db/schema/fleet";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
	CONNECTION_NOT_FOUND_MESSAGE,
	CONNECTION_STATUS_ACTIVE,
	CONNECTION_STATUS_ERROR,
	CREDENTIALS_VALIDATION_FAILED_MESSAGE,
	DEMO_CONNECTION_CREATE_FORBIDDEN_MESSAGE,
	DEMO_CONNECTION_REMOVE_FORBIDDEN_MESSAGE,
	SINGLE_RESULT_LIMIT_ROWS,
	TRIP_STATUS_ACTIVE,
	TRIP_STATUS_CANCELLED,
	VEHICLE_IMPORT_FAILED_MESSAGE,
} from "../constants";
import { organizationProcedure } from "../index";
import {
	connectionSummarySchema,
	entityIdInputSchema,
	fleetNameSchema,
} from "../schemas";

function connectionSummaries(
	database: Database,
	organizationId: string,
	connectionId?: string,
) {
	return database
		.select({
			id: gpsConnection.id,
			provider: gpsConnection.provider,
			label: gpsConnection.label,
			status: gpsConnection.status,
			lastSyncAt: gpsConnection.lastSyncAt,
			lastError: gpsConnection.lastError,
			createdAt: gpsConnection.createdAt,
			vehicleCount: database.$count(
				vehicle,
				and(
					eq(vehicle.organizationId, organizationId),
					eq(vehicle.connectionId, gpsConnection.id),
				),
			),
		})
		.from(gpsConnection)
		.where(
			and(
				eq(gpsConnection.organizationId, organizationId),
				connectionId ? eq(gpsConnection.id, connectionId) : undefined,
			),
		)
		.orderBy(desc(gpsConnection.createdAt), desc(gpsConnection.id));
}

export const connectionsRouter = {
	list: organizationProcedure
		.input(z.void())
		.output(z.array(connectionSummarySchema))
		.handler(async ({ context }) => {
			const connections = await connectionSummaries(
				context.db,
				context.organizationId,
			);
			context.log.set({
				fleet: {
					organizationId: context.organizationId,
					connectionsListed: connections.length,
				},
			});
			return connections;
		}),
	create: organizationProcedure
		.input(
			z.object({ label: fleetNameSchema, credentials: gpsCredentialsSchema }),
		)
		.output(connectionSummarySchema)
		.handler(async ({ context, input }) => {
			if (
				isDemoAccountEmail(context.session.user.email) &&
				input.credentials.provider !== "demo"
			) {
				throw new ORPCError("FORBIDDEN", {
					message: DEMO_CONNECTION_CREATE_FORBIDDEN_MESSAGE,
				});
			}
			if (input.credentials.provider === "demo") {
				context.log.set({
					fleet: {
						organizationId: context.organizationId,
						provider: input.credentials.provider,
					},
				});
				const sharedDemo = isDemoAccountEmail(context.session.user.email);
				const existingConnection = sharedDemo
					? await context.db.query.gpsConnection.findFirst({
							where: {
								organizationId: context.organizationId,
								provider: "demo",
							},
						})
					: undefined;
				const createdConnection = await ensureDemoConnection({
					...context,
					label: input.label,
					connectionId:
						existingConnection?.id ??
						(sharedDemo ? undefined : crypto.randomUUID()),
				});
				const [connection] = await connectionSummaries(
					context.db,
					context.organizationId,
					createdConnection.id,
				).limit(SINGLE_RESULT_LIMIT_ROWS);
				if (!connection)
					throw new ORPCError("NOT_FOUND", {
						message: CONNECTION_NOT_FOUND_MESSAGE,
					});
				context.log.set({
					fleet: {
						connectionId: createdConnection.id,
						vehiclesImported: connection.vehicleCount,
					},
				});
				return connection;
			}
			const provider = providerFor(input.credentials.provider);
			context.log.set({
				fleet: {
					organizationId: context.organizationId,
					provider: provider.kind,
				},
			});
			try {
				await provider.validateCredentials(input.credentials);
			} catch {
				throw new ORPCError("BAD_REQUEST", {
					message: CREDENTIALS_VALIDATION_FAILED_MESSAGE,
				});
			}
			const encryptedCredentials = await encryptJson(
				context.encryptionKey,
				input.credentials,
			);
			const connectionId = crypto.randomUUID();
			const createdAt = new Date();
			const createdConnection: typeof gpsConnection.$inferSelect = {
				id: connectionId,
				organizationId: context.organizationId,
				provider: provider.kind,
				label: input.label,
				encryptedCredentials,
				status: CONNECTION_STATUS_ACTIVE,
				lastSyncAt: null,
				lastError: null,
				createdAt,
				updatedAt: createdAt,
			};
			await context.db.insert(gpsConnection).values(createdConnection);
			context.log.set({ fleet: { connectionId } });
			const providerVehicles = await provider
				.listVehicles(input.credentials)
				.catch(async () => {
					await context.db
						.update(gpsConnection)
						.set({
							status: CONNECTION_STATUS_ERROR,
							lastError: VEHICLE_IMPORT_FAILED_MESSAGE,
						})
						.where(
							and(
								eq(gpsConnection.id, connectionId),
								eq(gpsConnection.organizationId, context.organizationId),
							),
						);
					throw new ORPCError("BAD_REQUEST", {
						message: VEHICLE_IMPORT_FAILED_MESSAGE,
					});
				});
			await importFleetVehicles({
				db: context.db,
				connection: createdConnection,
				vehicles: providerVehicles,
			});
			const [connection] = await connectionSummaries(
				context.db,
				context.organizationId,
				connectionId,
			).limit(SINGLE_RESULT_LIMIT_ROWS);
			if (!connection)
				throw new ORPCError("NOT_FOUND", {
					message: CONNECTION_NOT_FOUND_MESSAGE,
				});
			context.log.set({ fleet: { vehiclesImported: connection.vehicleCount } });
			return connection;
		}),
	remove: organizationProcedure
		.input(entityIdInputSchema)
		.output(entityIdInputSchema)
		.handler(async ({ context, input }) => {
			if (isDemoAccountEmail(context.session.user.email)) {
				throw new ORPCError("FORBIDDEN", {
					message: DEMO_CONNECTION_REMOVE_FORBIDDEN_MESSAGE,
				});
			}
			const connection = await context.db.query.gpsConnection.findFirst({
				columns: { id: true },
				where: { id: input.id, organizationId: context.organizationId },
			});
			if (!connection)
				throw new ORPCError("NOT_FOUND", {
					message: CONNECTION_NOT_FOUND_MESSAGE,
				});
			const connectionVehicles = context.db
				.select({ id: vehicle.id })
				.from(vehicle)
				.where(
					and(
						eq(vehicle.connectionId, input.id),
						eq(vehicle.organizationId, context.organizationId),
					),
				);
			const [cancelledTrips] = await context.db
				.update(trip)
				.set({ status: TRIP_STATUS_CANCELLED })
				.where(
					and(
						eq(trip.organizationId, context.organizationId),
						eq(trip.status, TRIP_STATUS_ACTIVE),
						inArray(trip.vehicleId, connectionVehicles),
					),
				);
			await resolveObsoleteAlerts({
				db: context.db,
				organizationId: context.organizationId,
				now: new Date(),
			});
			await context.db
				.delete(vehiclePosition)
				.where(inArray(vehiclePosition.vehicleId, connectionVehicles));
			const [removedVehicles] = await context.db
				.delete(vehicle)
				.where(
					and(
						eq(vehicle.connectionId, input.id),
						eq(vehicle.organizationId, context.organizationId),
					),
				);
			await context.db
				.delete(gpsConnection)
				.where(
					and(
						eq(gpsConnection.id, input.id),
						eq(gpsConnection.organizationId, context.organizationId),
					),
				);
			context.log.set({
				fleet: {
					organizationId: context.organizationId,
					connectionId: input.id,
					vehiclesRemoved: removedVehicles.affectedRows,
					tripsCancelled: cancelledTrips.affectedRows,
				},
			});
			return input;
		}),
};
