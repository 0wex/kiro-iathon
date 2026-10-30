import { and, gte, lte } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";
import type { z } from "zod";

import type { boundingBoxSchema } from "./schemas";

interface LocationColumns {
	lat: MySqlColumn;
	lng: MySqlColumn;
}

export function getBoundingBoxFilter(
	columns: LocationColumns,
	boundingBox: z.infer<typeof boundingBoxSchema> | undefined,
) {
	if (!boundingBox) {
		return undefined;
	}

	return and(
		gte(columns.lng, boundingBox.west),
		lte(columns.lng, boundingBox.east),
		gte(columns.lat, boundingBox.south),
		lte(columns.lat, boundingBox.north),
	);
}
