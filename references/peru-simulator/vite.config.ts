import { defineConfig } from 'vitest/config';

/** Weather backend (`npm run weather`); override with WEATHER_API_URL. */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const weatherApi = env.WEATHER_API_URL ?? 'http://127.0.0.1:8787';

export default defineConfig({
  worker: {
    format: 'es',
  },
  server: {
    proxy: { '/api': { target: weatherApi, changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: weatherApi, changeOrigin: true } },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
