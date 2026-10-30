import { PUBLIC_PROCEDURE_PATHS } from "@hack-the-andes-project/api/constants";
import type { AppRouterClient } from "@hack-the-andes-project/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin } from "@orpc/client/plugins";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ENV } from "../env.public";
import { m } from "../paraglide/messages";

export function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				if (query.meta?.silentError) return;
				toast.error(m.query_error({ message: error.message }), {
					action: {
						label: m.query_retry(),
						onClick: () => {
							query.invalidate();
						},
					},
				});
			},
		}),
	});
}

export const queryClient = createQueryClient();

export const link = new RPCLink({
	url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
	plugins: [
		new BatchLinkPlugin({
			// Buffered mode is required with evlog on the server: the default
			// streaming batch response is text/event-stream, which the wide-event
			// middleware tees, locking the single-use Workers response stream.
			mode: "buffered",
			groups: [{ condition: () => true, context: {} }],
			// The batch endpoint sits behind the server's auth guard, so public
			// procedures must travel alone to stay reachable while signed out.
			exclude: ({ path }) => PUBLIC_PROCEDURE_PATHS.has(path.join(".")),
		}),
	],
	fetch(url, options) {
		return fetch(url, {
			...options,
			credentials: "include",
		});
	},
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
