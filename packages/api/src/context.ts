import type { Auth, Session } from "@iathon-kiro/auth";
import type { Database } from "@iathon-kiro/db";
import type { RequestLogger } from "evlog";

import type { CitizenReportServices } from "./citizen-reports/services";

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
	// Optional so contexts built without AWS (tests, tools) stay valid; the
	// citizenReports procedures reject the call when it is missing.
	citizenReports?: CitizenReportServices;
}

export interface OrganizationContext extends Context {
	organizationId: string;
}
