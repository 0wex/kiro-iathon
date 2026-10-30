import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { ILLAPA_DEV_PORT } from "./src/constants";

export default defineConfig({
	output: "static",
	integrations: [react()],
	server: { port: ILLAPA_DEV_PORT },
	vite: {
		plugins: [tailwindcss()],
	},
});
