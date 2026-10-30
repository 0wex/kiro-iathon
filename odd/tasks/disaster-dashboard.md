# Disaster dashboard MVP

Objective: a standalone dashboard page of the xr-simulator viewer that shows simulated natural-disaster events of Peru on the 3D map, with an event list, an event detail card and a timeline that plays each event's simulation with synced charts.
Branch: `feat/disaster-dashboard`. Delivery: `ask-on-risk`, work-unit commits on the branch; push/PR left to the user. Tests: vitest (`pnpm --filter @iathon-kiro/xr-simulator test`), `pnpm check-types`, Biome.

## Specs

- **S1** (L1) "prioricemos un mvp, la idea es crear un dashboard donde se muestre los eventos/desastres naturales (por ahora simulaciones)".
- **S2** (L1, accepted option) "Página nueva del visor": a `dashboard.html` page inside `packages/xr-simulator` (Vite), needing only the tiles service — no login, no MySQL.
- **S3** (L1, accepted proposal) Layout as previewed: left "Eventos" list (e.g. "Huayco Chosica", "Inundación Pisco", "Deslizamiento"), center "Mapa 3D" with "terreno + casas + flujo animado", right event card ("Inicio", "Área", "Lluvia"), bottom "línea de tiempo" with play and charts "[área afectada]" and "[velocidad del flujo]".
- **S4** (L1, accepted proposal) Events come from an own catalogue (JSON) of scenarios at real places; choosing one flies the camera there; it is replaced by real data later.
- **S5** (L1) Only the 15 phase-1 low-poly models are used ("okey, usemos eso nomas por ahora"); no new models.
- **S6** Assumption (L2): each event is simulated by the dashboard itself with the headless `CpuSolver` on the z11 grid around it, not by driving `HuaycoMode` (private state, no events, no programmatic play). Event types are presets of the existing solver: huayco (Voellmy debris), inundación (low-friction water-like flow), deslizamiento (high-friction short release). Values shown are simulated and labelled as such.
- **S7** Assumption (L2): the flow is drawn as an overlay on the Peru overview (where the low-poly objects live), coloured by depth, and the camera flies to the event when it is chosen.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S4, S6 | inline | done | 0bd168d; RED (missing modules) → GREEN, eventCatalogue tests |
| T2 | S6 | inline | done | 0bd168d; eventSimulation tests; real-terrain run of the 4 events |
| T3 | S3, S7 | inline | done | 557eef3; overlay + focusOn verified in Chrome |
| T4 | S2, S3 | inline | done | 2833b92; chart tests RED → GREEN; page verified in Chrome |
| T5 | S1–S7 | inline | done | xr-simulator: tsc clean, 56 files / 460 tests, Biome clean; README section |

- T1: event catalogue (JSON) with type presets, parsing and validation.
- T2: headless event simulation (CpuSolver) recording depth frames and per-frame stats (affected area, max speed, volume).
- T3: overview hooks (overlay layers, fly-to) and the flow overlay mesh.
- T4: `dashboard.html` page: event list, event card, timeline (play/pause/speed/scrub) and synced SVG charts.
- T5: browser verification, docs, commits.

## Log

- **L1** (2026-10-30) User requests, verbatim: "okey, usemos eso nomas por ahora" — "prioricemos un mvp, la idea es crear un dashboard donde se muestre los eventos/desastres naturales (por ahora simulaciones)" — chose "Página nueva del visor (Recomendado)" for where to build it.
- **L2** (2026-10-30) Mapping: `HuaycoMode` keeps store, solver, recording and player private, emits no events and only plays on a key or click; there are no flood/landslide presets (rheology voellmy/bingham/herschel-bulkley plus volume and peak discharge). `CpuSolver` runs headless (tests use it), `fetchLocalGrid` gives a ~37 m grid centred on a point, `SolverStats.wetCells × cellSize²` is the wet area.
- **L3** (2026-10-30) Real-terrain runs (CPU, 128² at ~37 m): Chosica 12.4 ha peak / 9 m/s, Matucana 6.6 ha, Pisco 76.9 ha, San Mateo 5.5 ha; all volume stays in the grid; 9–20 s each, so the run moved to a Web Worker streaming frames. Browser: camera first aimed at sea level (relief not loaded) and sat inside the hill → `focusOn` now takes the grid elevation and turns to the town side so the flow runs toward the camera. Line colours validated with the dataviz palette checks (light `#b8692e,#2f6fb3,#8f6f1f`, dark `#c4823a,#4f8fd0,#b08f33`). Pre-existing: DEM spikes near Pisco (relief, not objects). Not verified: phone layout, dark mode.
