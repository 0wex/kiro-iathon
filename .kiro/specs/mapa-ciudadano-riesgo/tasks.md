# Tasks: Mapa ciudadano de riesgo

- [x] 1. Shared contract in `packages/business/src/citizen-reports`
  - Hazard kinds, priorities, plan sources, Piura bounding box and length limits in constants.
  - Zod input, report and plan schemas; `classifyByRules`, `templatePlanFor`, `compareReportsByPriority`, `distanceInMeters`.
  - Unit tests for schema limits, rules table, 500 m bump, sorting and templates.
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 3.4, 4.1_

- [ ] 2. Database tables and migration
  - `citizen_report` and `contingency_plan` with `mysqlTable`, exported from the schema index.
  - `pnpm db:generate --name citizen_report`.
  - _Requirements: 1.1, 3.1, 3.2_

- [ ] 3. Bedrock contingency planner
  - Converse call with the designed prompt, image block, nearby reports and forced tool.
  - Retry on ThrottlingException, 20 s timeout, template fallback, evlog fields.
  - Tests with the Bedrock client mocked.
  - _Requirements: 3.1, 3.3, 3.4_

- [ ] 4. `citizenReports` router
  - `create` (photo upload to B2, rules classification, insert), `list` (sorted, with plans) and `generatePlan` (Bedrock, upsert).
  - Server env: `BEDROCK_REGION`, `BEDROCK_MODEL_ID`, B2 media keys, in the env schema, alchemy env and the deploy runbook.
  - _Requirements: 1.1, 1.4, 2.1, 3.1, 3.2, 4.1_

- [ ] 5. Example reports in the demo seed
  - Piura example reports flagged `is_example`, inserted when missing.
  - _Requirements: 4.4_

- [ ] 6. Board page in `apps/web`
  - `/dashboard/reportes` with form, browser photo compression, map markers, prioritized list, detail panel and the contingency plan button and view.
  - `/demo` lands on it.
  - _Requirements: 1.1–1.4, 3.1, 3.2, 3.5, 4.1–4.3, 5.1_

- [ ] 7. Verify and document
  - `pnpm test`, `pnpm check-types`, `pnpm format:write`.
  - Main flow in a browser; README section and the portal frontend note and "Funcionalidad GenAI" text.
  - _Requirements: all_
