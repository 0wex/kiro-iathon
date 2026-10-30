# Tasks: Mapa ciudadano de riesgo

- [x] 1. Shared contract in `packages/business/src/citizen-reports`
  - Hazard kinds, priorities, plan sources, Piura bounding box and length limits in constants.
  - Zod input, report and plan schemas; `classifyByRules`, `templatePlanFor`, `compareReportsByPriority`, `distanceInMeters`.
  - Unit tests for schema limits, rules table, 500 m bump, sorting and templates.
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 3.4, 4.1_

- [x] 2. Database tables and migration
  - `citizen_report` and `contingency_plan` with `mysqlTable`, exported from the schema index.
  - `pnpm db:generate --name citizen_report`.
  - _Requirements: 1.1, 3.1, 3.2_

- [x] 3. Bedrock contingency planner
  - Converse call with the designed prompt, image block, nearby reports and forced tool.
  - Retry on ThrottlingException, 20 s timeout, template fallback, evlog fields.
  - Tests with the Bedrock client mocked.
  - _Requirements: 3.1, 3.3, 3.4_

- [x] 4. `citizenReports` router
  - `create` (photo upload to S3, rules classification, insert), `list` (sorted, with plans) and `generatePlan` (Bedrock, upsert).
  - Server env: `BEDROCK_REGION`, `BEDROCK_MODEL_ID`, `REPORT_PHOTOS_BUCKET`, `AWS_REGION` in the alchemy env map; no AWS keys (IAM role).
  - _Requirements: 1.1, 1.4, 2.1, 3.1, 3.2, 4.1_

- [x] 5. Example reports in the demo seed
  - Piura example reports flagged `is_example`, inserted when missing.
  - _Requirements: 4.4_

- [x] 6. Board page in `apps/web`
  - `/dashboard/reportes` with form, browser photo compression, map markers, prioritized list, detail panel and the contingency plan button and view.
  - `/demo` lands on it.
  - _Requirements: 1.1–1.4, 3.1, 3.2, 3.5, 4.1–4.3, 5.1_

- [ ] 7. AWS deployment with SAM
  - `template.yaml`: VPC with private subnets, RDS MySQL 8.4, Lambda for apps/server, HTTP API, S3 photos bucket, S3 web bucket, CloudFront with the API under `/rpc/*` and `/api/*`, Secrets Manager secrets, Bedrock and S3 VPC endpoints, least-privilege IAM.
  - Lambda entry for the server that migrates on cold start; deploy script that builds, runs `sam deploy`, builds the web with the CloudFront URL and syncs it.
  - _Requirements: 3.1, 5.1_

- [ ] 8. Verify and document
  - `pnpm test`, `pnpm check-types`, `pnpm format:write`.
  - Main flow in a browser; README section and the portal frontend note and "Funcionalidad GenAI" text.
  - _Requirements: all_
