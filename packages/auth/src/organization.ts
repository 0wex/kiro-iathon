import type { Database } from "@iathon-kiro/db";
import { member, organization } from "@iathon-kiro/db/schema/auth";

interface PersonalOrganizationOwner {
	id: string;
	name: string;
}

export async function ensurePersonalOrganization(
	database: Database,
	owner: PersonalOrganizationOwner,
) {
	const organizationId = owner.id;
	const createdAt = new Date();

	await database
		.insert(organization)
		.values({
			id: organizationId,
			name: owner.name,
			slug: `personal-${crypto.randomUUID()}`,
			createdAt,
		})
		.onDuplicateKeyUpdate({ set: { id: organizationId } });
	await database
		.insert(member)
		.values({
			id: crypto.randomUUID(),
			organizationId,
			userId: owner.id,
			role: "owner",
			createdAt,
		})
		.onDuplicateKeyUpdate({ set: { organizationId } });

	return organizationId;
}
