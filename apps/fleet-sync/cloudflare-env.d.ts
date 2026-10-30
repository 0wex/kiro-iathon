import type { FleetSyncEnv } from "@iathon-kiro/infra/alchemy.run";

export interface CloudflareEnv extends FleetSyncEnv {}

declare global {
	interface Env extends CloudflareEnv {}
}

declare module "cloudflare:workers" {
	namespace Cloudflare {
		export interface Env extends CloudflareEnv {}
	}
}
