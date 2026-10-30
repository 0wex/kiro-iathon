# Design: Mapa ciudadano de riesgo

## Architecture on AWS

Everything is deployed with AWS SAM from `template.yaml` at the repository root, into one AWS account.

```
Browser
  │  HTTPS, one origin (no CORS, first-party session cookie)
  ▼
Amazon CloudFront
  ├── /*            → S3 bucket with the built apps/web (SPA fallback to index.html)
  └── /rpc/*, /api/* → API Gateway HTTP API
                         ▼
                       AWS Lambda (Node 24, apps/server bundled with tsdown, inside a VPC)
                         ├── packages/api  citizenReports.create / list / generatePlan
                         ├── Amazon Bedrock Runtime  Converse API (VPC interface endpoint)
                         ├── Amazon S3  report photos (VPC gateway endpoint)
                         └── Amazon RDS for MySQL 8.4 (private subnets)
```

The Lambda reaches Bedrock and S3 through its IAM execution role (`bedrock:InvokeModel` on the configured model, `s3:PutObject`/`s3:GetObject` on the photos bucket); no AWS keys are stored. Database credentials and the auth secrets live in AWS Secrets Manager and reach the function as CloudFormation dynamic references. Pending migrations run on cold start before the first request is served.

## Why rules for priority and AI for the plan

Priority decides the order of the board, so it must be instant, repeatable and explainable: a keyword table plus a proximity bump does that without a model. The contingency plan is the slow, expert writing task that coordinators do by hand today; that is where a model saves minutes, and it is generated only when someone asks for it, which also bounds Bedrock cost.

## Shared contract (packages/business/src/citizen-reports)

- `HAZARD_KINDS`: inundacion, huayco, deslizamiento, colapso-drenaje, erosion-defensa, otro.
- `REPORT_PRIORITIES`: critica, alta, media, baja, with a sort rank.
- `PLAN_SOURCES`: bedrock, plantilla.
- `createCitizenReportInputSchema` (zod): description 10–600 chars, location `{ lon, lat }` inside the Piura bounding box, optional photo `{ mediaType, base64 }` of at most 600 KB decoded.
- `citizenReportSchema`: id, description, location, photoUrl or null, hazardKind, priority, isExample, createdAt, plan or null.
- `contingencyPlanSchema`: situation (≤ 400 chars), actions (3–6 ordered strings), resources (strings), responsibles (strings), populationMessage (≤ 280 chars), source, generatedAt.
- `classifyByRules(description, nearbyReports)`: keyword table for hazard and priority, plus one level up when a same-hazard report lies within 500 m.
- `templatePlanFor(hazardKind)`: the fallback plan per hazard.
- `compareReportsByPriority`: priority rank, then newest first.
- `distanceInMeters`: haversine, used for the 500 m bump and the 2 km context.

## Bedrock contingency plan (packages/api)

- `ConverseCommand` with a system prompt that names the reader (a Piura district authority coordinating FEN response with brigades, the municipality, COER Piura and bomberos), asks for concrete, safe and ordered actions, a neutral Spanish tone, the length limits, and forbids inventing official declarations or phone numbers.
- The user message carries the report (description, hazard, priority, coordinates, time), the photo as an image block, and up to 10 reports within 2 km.
- `toolConfig` forces one tool `plan_de_contingencia` whose JSON schema is `contingencyPlanSchema` without source and time; the tool input is validated with zod.
- Retries: `ThrottlingException` retried twice (backoff 500 ms, 1000 ms). An `AbortSignal` caps each call at 20 s.
- Any failure or invalid output returns `templatePlanFor(hazardKind)` with source `plantilla`; the error name and latency go to the request's evlog event.

## Data model (packages/db)

- `citizen_report`: `id` varchar primary key, `description` text, `longitude`/`latitude` double, `photo_key` varchar nullable (the API returns `photoUrl`), `hazard_kind`, `priority` varchar, `is_example` boolean, `reporter_user_id` varchar nullable, `created_at` timestamp.
- `contingency_plan`: `report_id` varchar primary key (one current plan per report), `plan` json, `source` varchar, `generated_at` timestamp.
- No foreign keys. Migration generated with `pnpm db:generate --name citizen_report`.

## API

- `citizenReports.create` (protected): validates input, uploads the photo to S3, classifies by rules against the existing reports, inserts, returns the stored report.
- `citizenReports.list` (protected): every report with its plan, sorted by `compareReportsByPriority`.
- `citizenReports.generatePlan` (protected, `{ reportId }`): loads the report and its 2 km neighbours, calls Bedrock, upserts the plan, returns it.

## Web (apps/web)

- New route `/dashboard/reportes`: the report form (description, photo, location picked on the map or from the device), the prioritized list with badges, a map with priority-coloured markers, and a detail panel with the "Generar plan de contingencia" button, a loading state, and the plan with its source label and the disclaimer.
- `/demo` lands on this route.

## Testing

- Business: schema limits, rules table, 500 m bump, sorting, template plans.
- API: Bedrock client mocked; plan success, throttling retry, template fallback on failure and on invalid output, validation errors.
- Web: type-check and a manual pass of the main flow in a browser.
