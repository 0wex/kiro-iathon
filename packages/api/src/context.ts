import type { Auth, Session } from "@iathon-kiro/auth";
import type { Database } from "@iathon-kiro/db";
import type { RequestLogger } from "evlog";

export interface Context {
	db: Database;
	auth: Auth;
	log: RequestLogger;
	session: Session;
	encryptionKey: string;
	osrmBaseUrl: string;
	// Extends the request lifetime for fire-and-forget work through the
	// Workers ExecutionContext. Outside Workers the promise is left floating.
	waitUntil: (promise: Promise<unknown>) => void;
}

export interface OrganizationContext extends Context {
	organizationId: string;
}
