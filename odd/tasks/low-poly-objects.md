# Low-poly objects on the Peru map (phase 1)

Objective: populate the xr-simulator Peru overview with procedural low-poly houses (inside INEI city blocks) and vegetation (from MINAM land cover), phase 1 scoped to the Carretera Central corridor (Lima–Huancayo).
Branch: `feat/low-poly-objects`. Delivery: `ask-on-risk`, work-unit commits on the branch; push/PR left to the user. Tests: vitest (`pnpm --filter @iathon-kiro/xr-simulator test`), `pnpm check-types`, `pnpm format:write`.

## Specs

- **S1** (L1) "hagamoslo nomás con lo q se tenga, con el Geoservidor público del INEI, a futuro integraremos por material de vivienda". Houses are placed inside INEI `Interoperabilidad:ig_manzana` block polygons (public WFS `https://geoespacial.inei.gob.pe/Interoperabilidad/ows`). The house type is chosen from region/altitude rules, not from housing material; the type selection must be a single replaceable rule so the census material data can drive it later.
- **S2** (L1, accepted phase-1 scope) "Fase 1: Carretera Central (15)": houses — costa: "1 piso con techo plano", "2–3 pisos con fierros y tanque", "edificio de 4–6 pisos", "vivienda de estera"; sierra: "adobe con teja", "adobe con calamina", "ladrillo de 2–3 pisos con calamina"; landmarks: "iglesia y plaza"; vegetation: "ichu, tola, queñual, eucalipto, cactus columnar y arbusto espinoso".
- **S3** (L1) Models are "generados por código" in the viewer (Babylon.js), "colores planos por vértice con la paleta de unos 12 colores, sin texturas", parametric so one model yields variants, and drawn with `thinInstances`.
- **S4** Vegetation placement uses the MINAM "Cobertura Vegetal" ArcGIS REST service (`ServicioCoberturaVegetal_MINAM/MapServer/0`, field `CobVeg2013`) to choose which vegetation model appears, plus altitude rules. Assumption: classes without phase-1 models (water, glacier, bare high Andes, desert, wetlands) place no vegetation.
- **S5** Placement is deterministic: the same block or tile always yields the same objects (seed derived from the block id or tile key).
- **S6** Assumption: both layers are fetched through same-origin proxies (`/inei-api`, `/minam-api`) because the INEI WFS sends no CORS headers; the standalone viewer's Vite proxy gets them in phase 1. The dashboard (`apps/server` proxy routes) is out of phase 1 scope; the layer stays off when its base URL is not configured.
- **S7** Assumption: the web UI gets toggles to show/hide houses and vegetation, and the INEI and MINAM sources are credited in the viewer attribution and `services/ATRIBUCIONES.md`.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S4, S6 | inline | done | `ee52b7f`; RED/GREEN objectSources 7/7, endpoints 6/6 (3 prior cases kept) |
| T2 | S1, S4, S5 | inline | done | `ee52b7f`; RED/GREEN objectPlacement 19/19, objectTiles 3/3, tilePlacement 6/6 |
| T3 | S2, S3 | delegated (writer trigger a: parallel with T1/T2/T4, disjoint surface) | done | `41cab05`; RED/GREEN objectModels 9/9; winding fixed by parent after visual check |
| T4 | S3, S5 | inline | done | `f80d1bf`; verified in the browser (Matucana, puna near Ticlio) |
| T5 | S6, S7 | inline | done | `f80d1bf` (toggles, credit, `services/ATRIBUCIONES.md`) |

- T1: data clients for INEI blocks and MINAM land cover by tile bbox, proxies, parsing.
- T2: placement — points inside block polygons, deterministic RNG, house-type and vegetation rules.
- T3: the 15 procedural low-poly models and the shared vertex-color palette.
- T4: render layer — thin instances per tile, LOD lifecycle, terrain height sampling.
- T5: UI toggles, attribution, docs.

## Log

- **L1** (2026-10-30) User requests, verbatim: "okey hagamoslo nomás con lo q se tenga, con el Geoservidor público del INEI, a futuro integraremos por material de vivienda. dime cuantos modelos low poly crearás?" — then, after the phase-1 proposal (15 models for the Carretera Central): "empieza".
- **L2** (2026-10-30) Evidence: INEI WFS has no CORS headers; a ~2 km bbox returns 114 blocks in Matucana (143 KB, 1.5 s) and 470 in Miraflores (292 KB, 1.8 s); `ig_manzana` fields: `ubigeo`, `zona`, `manzana`, `idmanzana`. MINAM land cover reflects CORS; a ~4 km bbox around Matucana returns 7 polygons (Agricultura costera y andina, Matorral arbustivo, Cardonal), 1.18 MB raw or 182 KB with `maxAllowableOffset=0.0005`.
- **L3** (2026-10-30) Visual check found every face inside-out: Babylon's StandardMaterial shows the side (v1 − v0) × (v2 − v0) points away from (the terrain uses its own shader, so it was not a valid reference). The winding test now pins Babylon's convention and the builder stores the inward-crossing order.
- **L4** (2026-10-30) Performance: vegetation sampling took 1 539 ms per puna tile (point-in-polygon per cell against 56 828 MINAM vertices) and a full rebuild 131 ms, dropping to 6 fps while loading. Row-strip edge crossings bring a tile to 68 ms, blocks get a bbox prefilter, rebuilds are throttled to the update interval and write straight into the buffer (40 ms). Steady state 103–124 fps with ~71 000 objects; worst while loading 69 fps.
- **L5** (2026-10-30) Verification: `tsc --noEmit` clean (xr-simulator and ui), Biome clean on changed files, vitest 53 files / 443 tests passed. Native assessment of `b7cfd62..f80d1bf` (untracked excluded): risk `medium` (executable_change in PeruOverview.ts), `review_due: false` (`under_budget`). Engram mirror pending: the project name is ambiguous (`fen-challenge` / `illapa-app`).
- **Next**: dashboard proxy routes in `apps/server` (S6 out of phase-1 scope), VR menu toggles, housing-material rule (S1 future), phase-2 models.
