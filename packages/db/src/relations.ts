import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = {
	...defineRelations(schema),
	...schema.authRelations,
	...schema.fleetRelations,
	organization: {
		...schema.authRelations.organization,
		relations: {
			...schema.authRelations.organization.relations,
			...schema.fleetRelations.organization.relations,
		},
	},
};
