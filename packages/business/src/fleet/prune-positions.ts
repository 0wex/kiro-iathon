import type { Database } from "@iathon-kiro/db";
import { vehiclePosition } from "@iathon-kiro/db/schema/fleet";
import { lt } from "drizzle-orm";

import {
	POSITION_RETENTION_BATCH_SIZE_ROWS,
	POSITION_RETENTION_MS,
} from "../constants";

export async function pruneVehiclePositions(db: Database, now: Date) {
	const [deleted] = await db
		.delete(vehiclePosition)
		.where(
			lt(
				vehiclePosition.recordedAt,
				new Date(now.getTime() - POSITION_RETENTION_MS),
			),
		)
		.limit(POSITION_RETENTION_BATCH_SIZE_ROWS);
	return deleted.affectedRows;
}
