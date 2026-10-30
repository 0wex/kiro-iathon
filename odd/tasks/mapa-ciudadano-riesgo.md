# Mapa ciudadano de riesgo (Kiro IAthon submission)

Objective: prepare the repo for the Kiro IAthon track "Mapa ciudadano de riesgo": Kiro specs/steering/hooks, a citizen report flow with a prioritized board in `apps/web`, and Bedrock-generated contingency plans. Branch `feat/kiro-submission`. Delivery: `ask-on-risk`, work-unit commits; push/PR left to the user. Tests: vitest (`pnpm test`), `pnpm check-types`, Biome.

## Specs

The requirements, design and task list live in `.kiro/specs/mapa-ciudadano-riesgo/` (requirements.md R1–R5, design.md, tasks.md 1–7) and are the specification workers read.

- **S1** (L1) "analiza esta rubrica y aplica lo necesario para prepararlo para enviar ... considera la rubrica de entrega, especialmente código y frontend, y las 2 insignias Maestría Kiro y GenAI con propósito". Maestría Kiro: `.kiro/specs/<feature>/` with requirements, design and tasks of 300+ chars each, a steering of 200+ chars, a hook with "when" and "then". GenAI con propósito: Bedrock or AgentCore in a central product flow, designed prompts and error handling.
- **S2** (L2) Track: "Mapa ciudadano de riesgo (Recommended)" — Vecinos, brigadas y autoridades de Piura; reporte de puntos críticos con foto y tablero priorizado.
- **S3** (L3) Frontend: "apps/web en /demo (Recommended)".
- **S4** (L4) "usa la genai para poder generar planes de contingencia dentro del dashboard". Decision: priority by deterministic rules, Bedrock writes the contingency plan on demand (R2, R3).
- **S5** (L6) "recuerda no hacer ningun despliegue, solo subir al repositorio": no deploy; push the branch to origin.
- **S6** (L7) Zip for Entregas > Código: "un solo archivo .zip de hasta 200 MB con la carpeta raíz del proyecto. Debe incluir la carpeta .kiro/ completa (specs, steering y hooks), template.yaml, src/, tests/ y README.md"; scan for "AKIA", "secret" and emails; check with `unzip -l ../proyecto.zip | grep .kiro/specs` and `ls -lh ../proyecto.zip`; "Usa datos simulados o públicos, nunca datos personales reales"; "No conectes sistemas externos: solo nuestra cuenta de AWS y los servicios declarados en template.yaml."

## Tasks

| ID | Specs | Kiro task | Route | Status | Evidence |
|---|---|---|---|---|---|
| T0 | S1, S2 | — | inline | done | 629fc2d `.kiro/` steering, hooks, spec; README first line |
| T1 | S2, S4 | 1 | inline | done | 24beea9; RED (missing module, then talud/alud and undefined index) → GREEN business 267 tests, tsc clean; ee60fa8 Bedrock SDK 3.1152.0 |
| T2 | S2, S4 | 2–5 | delegated (Writer trigger a: parallel with T3, disjoint surfaces) | done | e607661, b7a523a, 0ea0fb8; planner RED→GREEN 11, router RED→GREEN 10, seed RED→GREEN; api 110 tests |
| T3 | S3, S4 | 6 | delegated (Writer trigger a: parallel with T2, disjoint surfaces) | done | d0b2842; web 27 tests, vite build OK |
| T5 | S2, S5 | 7 (SAM) | delegated after T2 (Writer trigger b: context backstop) | pending | |
| T4 | S1, S5, S6 | 8 | inline | pending | |

## Log

- **L1** (2026-10-30) User request, verbatim: "analiza esta rubrica y aplica lo necesario para prepararlo para enviar. https://dse8jbss45rea.cloudfront.net/reglas considera la rubrica de entrega, especialmente código y frontend, y las 2 insignias Maestría Kiro y GenAI con propósito".
- **L2** (2026-10-30) Rubric (from the portal bundle): code 350 = static 100 (specs, steering, hooks, README, IaC, tests) + agent 250 (problemFit 50, solutionDesign 50, implementationQuality 60, kiroProcess 50, genaiPurpose 40); frontend 150 (loads 40, mainFlow 50, usability 30, coherence 30); zip ≤ 200 MB; frontend URL must answer 200 text/html without redirect or login, with a 1–3 step note ≤ 240 chars and a "Funcionalidad GenAI" text ≤ 240 chars. Gaps found: no `.kiro/`, GenAI only via AI SDK in the scraper, `dash.getillapa.com` does not resolve DNS, README first line, product brief targets a non-existent track.
- **L3** (2026-10-30) User chose track "Mapa ciudadano de riesgo" and frontend "apps/web en /demo".
- **L4** (2026-10-30) User, verbatim: "usa la genai para poder generar planes de contingencia dentro del dashboard".
- **L5** (2026-10-30) Photo limit lowered to 600 KB so a create request stays under the server's 1 MB body cap. Bedrock SDK pinned to 3.1152.0 (published 2026-10-14). /demo signs in the demo account, so the procedures stay protected and no public paths are added.
- **L6** (2026-10-30) User, verbatim: "el proyecto se subira a github y de ahi se desplegará con ayuda de kiro browser, desde ahí kiro usará la cuenta de aws q tiene asignara y usará los recursos propios de aws para hacer el despliegue" — then chose "SAM serverless (Recommended)"; photos move from B2 to S3. Then: "okey, recuerda no hacer ningun despliegue, solo subir al repositorio".
- **L7** (2026-10-30) User pasted the portal's zip checklist (S6).
- **L8** (2026-10-30) Seam check after T2+T3: `pnpm check-types` exit 0; `pnpm test` exit 0 (business 268, api 110, web 27, server 23, xr-simulator 455, others green). Env names: BEDROCK_REGION, BEDROCK_MODEL_ID, REPORT_PHOTOS_BUCKET, AWS_REGION. Open: `apps/server/.env.schema` and `packages/infra/.env.schema` entries not written (writer denied `.env*` by permissions; surfaced to the user). Photos stored by key; public URL to be served through CloudFront in T5 instead of a public bucket.
- Next: T5 SAM, independent verifier, T4 (zip, push).
