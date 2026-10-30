# Mapa ciudadano de riesgo (Kiro IAthon submission)

Objective: prepare the repo for the Kiro IAthon track "Mapa ciudadano de riesgo": Kiro specs/steering/hooks, a citizen report flow with a prioritized board in `apps/web`, and Bedrock-generated contingency plans. Branch `feat/kiro-submission`. Delivery: `ask-on-risk`, work-unit commits; push/PR left to the user. Tests: vitest (`pnpm test`), `pnpm check-types`, Biome.

## Specs

The requirements, design and task list live in `.kiro/specs/mapa-ciudadano-riesgo/` (requirements.md R1–R5, design.md, tasks.md 1–7) and are the specification workers read.

- **S1** (L1) "analiza esta rubrica y aplica lo necesario para prepararlo para enviar ... considera la rubrica de entrega, especialmente código y frontend, y las 2 insignias Maestría Kiro y GenAI con propósito". Maestría Kiro: `.kiro/specs/<feature>/` with requirements, design and tasks of 300+ chars each, a steering of 200+ chars, a hook with "when" and "then". GenAI con propósito: Bedrock or AgentCore in a central product flow, designed prompts and error handling.
- **S2** (L2) Track: "Mapa ciudadano de riesgo (Recommended)" — Vecinos, brigadas y autoridades de Piura; reporte de puntos críticos con foto y tablero priorizado.
- **S3** (L3) Frontend: "apps/web en /demo (Recommended)".
- **S4** (L4) "usa la genai para poder generar planes de contingencia dentro del dashboard". Decision: priority by deterministic rules, Bedrock writes the contingency plan on demand (R2, R3).

## Tasks

| ID | Specs | Kiro task | Route | Status | Evidence |
|---|---|---|---|---|---|
| T0 | S1, S2 | — | inline | done | `.kiro/` steering, hooks, spec; README first line |
| T1 | S2, S4 | 1 | inline | pending | |
| T2 | S2, S4 | 2–5 | delegated (parallel with T3) | pending | |
| T3 | S3, S4 | 6 | delegated (parallel with T2) | pending | |
| T4 | S1 | 7 | inline | pending | |

## Log

- **L1** (2026-10-30) User request, verbatim: "analiza esta rubrica y aplica lo necesario para prepararlo para enviar. https://dse8jbss45rea.cloudfront.net/reglas considera la rubrica de entrega, especialmente código y frontend, y las 2 insignias Maestría Kiro y GenAI con propósito".
- **L2** (2026-10-30) Rubric (from the portal bundle): code 350 = static 100 (specs, steering, hooks, README, IaC, tests) + agent 250 (problemFit 50, solutionDesign 50, implementationQuality 60, kiroProcess 50, genaiPurpose 40); frontend 150 (loads 40, mainFlow 50, usability 30, coherence 30); zip ≤ 200 MB; frontend URL must answer 200 text/html without redirect or login, with a 1–3 step note ≤ 240 chars and a "Funcionalidad GenAI" text ≤ 240 chars. Gaps found: no `.kiro/`, GenAI only via AI SDK in the scraper, `dash.getillapa.com` does not resolve DNS, README first line, product brief targets a non-existent track.
- **L3** (2026-10-30) User chose track "Mapa ciudadano de riesgo" and frontend "apps/web en /demo".
- **L4** (2026-10-30) User, verbatim: "usa la genai para poder generar planes de contingencia dentro del dashboard".
- Next: T1 shared contract inline, then T2 and T3 in parallel.
