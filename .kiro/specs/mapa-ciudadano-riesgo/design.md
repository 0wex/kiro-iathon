# Design Document

## Overview

The feature delivers the user story in `requirements.md`: report a critical point with a photo, see it ranked on a map, and get a contingency plan written by Amazon Bedrock. Instead of the starter kit's Python Lambda and DynamoDB, it is built on our existing TypeScript monorepo (Hono + oRPC server, React dashboard, MySQL with Drizzle), which already had authentication, the demo account, maps and tests; `template.yaml` deploys that same server to Lambda.

Priority is decided by rules and the plan by the model. Priority orders the board, so it must be instant, repeatable and explainable: a keyword table plus a proximity bump does that without a model. The contingency plan is the slow, expert writing task that coordinators do by hand today; that is where a model saves minutes, and it is generated only when someone asks for it, which also bounds Bedrock cost.

## Architecture

Everything is deployed with AWS SAM from `template.yaml` at the repository root, into one AWS account.

```
Browser
  │  HTTPS, one origin (no CORS, first-party session cookie)
  ▼
Amazon CloudFront
  ├── /*                 → S3 bucket with the built apps/web (SPA fallback to index.html)
  ├── /citizen-reports/* → S3 photos bucket (read through Origin Access Control)
  └── /rpc/*, /api/*     → API Gateway HTTP API
                              ▼
                            AWS Lambda (Node 24, apps/server bundled with tsdown, inside a VPC)
                              ├── packages/api  citizenReports.create / list / generatePlan
                              ├── Amazon Bedrock Runtime  Converse API (VPC interface endpoint)
                              ├── Amazon S3  report photos (VPC gateway endpoint)
                              └── Amazon RDS for MySQL 8.4 (private subnets)
```

The Lambda reaches Bedrock and S3 through its IAM execution role (`bedrock:InvokeModel` on the configured model, `s3:PutObject`/`s3:GetObject` on the photos prefix); no AWS keys are stored. Database credentials and the auth secrets live in AWS Secrets Manager and reach the function as CloudFormation dynamic references. Pending migrations run on cold start before the first request is served.

## Components and Interfaces

What changes, by package (the equivalent of the kit's `src/app.py` and `src/web/`):

- `packages/business/src/citizen-reports/`: the shared contract.
  - `createCitizenReportInputSchema`: description 10–600 chars, location inside the Piura bounding box, optional photo of at most 600 KB.
  - `contingencyPlanContentSchema`: situation ≤ 400 chars, 3–6 actions, resources, responsibles, population message ≤ 280 chars.
  - `classifyByRules`, `compareReportsByPriority`, `reportsNear`, `templatePlanFor`, and the example Piura reports.
- `packages/api/src/citizen-reports/`: `services.ts` (Bedrock and S3 clients on the default credential chain), `prompt.ts` (system prompt, tool schema, user text) and `planner.ts` (`generateContingencyPlan`).
- `packages/api/src/routers/citizen-reports.ts`: three protected oRPC procedures.
  - `list()` returns `CitizenReport[]` sorted by priority, each with its plan.
  - `create(CreateCitizenReportInput)` uploads the photo, classifies by rules and stores; returns the `CitizenReport`.
  - `generatePlan({ reportId })` calls Bedrock with the report, its photo and up to 10 reports within 2 km, upserts and returns the `ContingencyPlan`; unknown id is NOT_FOUND.
- `apps/server`: builds the services once per process and passes them through the oRPC context; a Lambda entry wraps the same fetch handler.
- `apps/web`: route `/dashboard/reportes` with the report form (browser photo compression, map click or device location), the prioritized list, the map with priority-coloured markers, and the detail panel with "Generar plan de contingencia"; `/demo` lands on it.

### Prompt design

The system prompt names the reader (a Piura district authority coordinating the FEN response with brigades, the municipality, COER Piura and bomberos), asks for concrete, safe and ordered actions in neutral Spanish within the length limits, forbids inventing official declarations or phone numbers, and treats report text as data, never as instructions. `toolConfig` forces one tool, `plan_de_contingencia`, whose JSON schema mirrors `contingencyPlanContentSchema`, so the answer is structured and validated instead of parsed from free text.

## Data Models

- `citizen_report`: `id` varchar primary key, `description` text, `longitude`/`latitude` double, `photo_key` varchar nullable (the API returns `photoUrl`), `hazard_kind`, `priority` varchar, `is_example` boolean, `reporter_user_id` varchar nullable, `created_at` timestamp.
- `contingency_plan`: `report_id` varchar primary key (one current plan per report), `plan` json, `source` varchar, `generated_at` timestamp.
- Tables use `mysqlTable` (`iathon_kiro_` prefix), no foreign keys; the migration is generated with `pnpm db:generate --name citizen_report`.

## Error Handling

- Invalid input returns BAD_REQUEST with the Spanish validation message; nothing is stored.
- `ThrottlingException` from Bedrock is retried twice (500 ms, then 1000 ms); each call is capped at 20 s.
- Any other Bedrock error, a timeout, a missing tool call or an invalid plan returns the template plan for the hazard kind with source `plantilla`; the flow never breaks.
- If the stored photo cannot be read back, the plan is generated from text only.
- Every outcome is logged in the request's evlog wide event: plan source, failure reason, attempts, latency and nearby report count.

## Testing Strategy

- Business (vitest): schema limits, rules table, people-at-risk rule, 500 m bump, sorting, template validity.
- API (vitest, Bedrock and S3 mocked, never AWS): plan success with prompt, photo and nearby reports; throttling retried then success; template on other errors, timeout and invalid output; NOT_FOUND; validation errors; list ordering.
- Demo seed: example reports inserted once.
- Web: type-check, unit tests, and the main flow walked in a browser.
