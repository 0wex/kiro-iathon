import { NODE_BUNDLE_ALIASES } from "@iathon-kiro/node-runtime/bundle-aliases";
import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/lambda.ts",
	platform: "node",
	format: "esm",
	outDir: "./dist-lambda",
	clean: true,
	alias: NODE_BUNDLE_ALIASES,
	copy: "../../packages/db/src/migrations",
	deps: {
		alwaysBundle: [/.*/],
		onlyBundle: false,
	},
});
