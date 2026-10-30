# Project conventions

Product: a citizen risk map for Piura during El Niño (FEN). Neighbours, brigades and local authorities report critical points (flooded streets, blocked drains, cracked embankments, landslides) with a photo, a description and a location; rules rank them on a prioritized board and map, and Amazon Bedrock writes a contingency plan for any critical point.

## Stack

- pnpm monorepo, TypeScript everywhere, Biome for lint and format.
- API: Hono + oRPC in `apps/server` with procedures in `packages/api/src/routers`.
- Database: Drizzle + MySQL 8.4 in `packages/db`. Every table uses `mysqlTable` from `packages/db/src/schema/_table.ts` (`iathon_kiro_` prefix) and has no FOREIGN KEY constraints.
- GenAI: Amazon Bedrock Converse API through `@aws-sdk/client-bedrock-runtime`, called only from the server.
- Board and map: the Vite + React dashboard in `apps/web` (`/dashboard/reportes`, reached from `/demo`).
- Infrastructure as code: Alchemy in `packages/infra` for local dev, Dockerfiles in `deploy/` for Dokploy on AWS EC2.

## Naming

- Descriptive names, no one- or two-letter variables, interfaces over type aliases.
- Magic numbers live in `constants.ts` in `SCREAMING_SNAKE_CASE` with unit suffixes (`_MS`, `_PX`, `_CHARS`).
- Spanish only in user-facing copy for Piura; code, comments, commits and docs in English.

## How to test

- `pnpm test` runs every package's vitest suite; `pnpm --filter <package> test` runs one.
- `pnpm check-types` and `pnpm format:write` after every change.
- Bedrock is always mocked in tests; never call AWS from a test.

## What not to do

- Never read `process.env` in the server: use `apps/server/src/env.server.ts`.
- Never hand-edit `packages/db/src/migrations`; run `pnpm db:generate --name <change>`.
- Never use `db.transaction()` or create a db connection in module scope.
- Never log with `console.log`; use the evlog wide event (`context.log.set`).
- Never make a route public without adding it to `PUBLIC_PROCEDURE_PATHS` on purpose.
- A Bedrock failure must never break the flow: return the template contingency plan marked as `plantilla`.

## Deployment

- Infrastructure as code lives in `template.yaml` (AWS SAM); `deploy/aws/deploy.sh` is the only deploy path.
- Deploy only when the team decides to; an agent session never deploys on its own.
- No AWS keys in code or env files: the Lambda's IAM role grants Bedrock and S3.
