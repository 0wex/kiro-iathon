import { DEMO_ACCOUNT_EMAIL } from "@iathon-kiro/business/demo-account";
import {
	prepareDemo,
	restartFinishedDemo,
} from "@iathon-kiro/business/demo-seed";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { DEMO_PREPARE_FORBIDDEN_MESSAGE } from "../constants";
import { organizationProcedure } from "../index";

export const demoPrepareOutputSchema = z.object({
	vehicleCount: z.number().int().nonnegative(),
	tripCount: z.number().int().nonnegative(),
});

export const demoRouter = {
	prepare: organizationProcedure
		.input(z.void())
		.output(demoPrepareOutputSchema)
		.handler(async ({ context }) => {
			if (context.session.user.email !== DEMO_ACCOUNT_EMAIL)
				throw new ORPCError("FORBIDDEN", {
					message: DEMO_PREPARE_FORBIDDEN_MESSAGE,
				});
			return (await restartFinishedDemo(context)) ?? prepareDemo(context);
		}),
};
