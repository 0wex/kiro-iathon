# ILLAPA PRD (MVP)

*Owner: David · Status: agreed 17 Oct 2026 · Web: review-route space · Backend: Owen*

Read the [project brief](project_brief.md) first.

## Goal

Prove on real data that a planner can check a route, see what is risky now and in the next 24 hours, and get a recommendation they trust because every claim has a source.

## User and job

Route planner at a freight carrier or agroexporter. Before a truck leaves: is this route safe for this vehicle in this time window, and if not, what do I do?

## Core flow: Revisar ruta

1. Pick an origin and a destination from a list of cities on the central corridors (Lima to Huancayo is preselected), one of your vehicles, and a departure time within the next 24 h (default: now).
2. Press **Revisar**. ILLAPA scores every candidate path: the ones our routing finds and SUTRAN's official detours. For Lima to Huancayo that is the Carretera Central plus SUTRAN's Rutas 1 to 5, which include the roads via Canta and via Cañete. A path that matches a SUTRAN detour is listed once, as the detour.
3. Each path is split into segments of about 5 km. Each segment gets a level (Bajo, Moderado, Alto, Crítico) for Ahora and 24 h (48 and 72 h later). Its signals are labeled confirmed, forecast or baseline.
4. Each path gets Continuar, Monitorear, Retrasar or Desviar from the rules below. The recommended path comes first, then the rest by risk, then by time.
5. AI writes a short explanation and preventive plan for each path, citing each source and when it was observed.
6. **Planificar viaje** saves the chosen path as a planned trip for that vehicle.

## What each path shows

- The level with its text label and a 0 to 100 score, the recommendation, the distance and the estimated time.
- An Ahora / 24 h toggle.
- The three signals kept separate: confirmed disruption, forecast hazard and baseline exposure.
- **Por qué:** the rules that fired, their sources and the AI explanation.
- **SUTRAN detours** sit in their own group, "Desvíos oficiales SUTRAN", with a source badge and a dashed line on the map. ILLAPA's paths are solid lines. Detours that the vehicle's axles don't allow stay in the list, greyed out, with the reason ("No habilitado para 6 ejes").
- **Map:** the selected path's segments take their risk colour, and confirmed disruptions use the existing incident icons. Baseline exposure appears only in the card text, so the map stays readable.

## Recommendation rules

Rules decide. AI only explains.

| Situation on the route | Recommendation |
| --- | --- |
| Confirmed interruption | Desviar to a detour that fits the vehicle |
| Confirmed restriction | Monitorear and show the expected delay |
| Alto or Crítico forecast inside the trip window | Retrasar if a later window is lower, otherwise Desviar |
| Baseline exposure only | Continuar, with a note |
| Nothing relevant | Continuar |

## Vehicles and planned trips

- **Vehicles:** units imported from GPS (Geotab, Samsara), plus units added by hand with a name, an optional plate and a type. The type sets the axle count, which decides which SUTRAN detours the vehicle may use.

| Type | Code | Axles | Gross weight |
| --- | --- | --- | --- |
| Camioneta pick-up | — | 2 | ~3 t |
| Camión ligero / furgón | C2 | 2 | ~12 t |
| Camión | C3 | 3 | ~25 t |
| Bus interprovincial | B3 | 3 | ~18 t |
| Tracto + semirremolque | T2S3 | 5 | ~43 t |
| Tracto + semirremolque | T3S3 | 6 | ~48 t |
| Otro | — | Entered by the user | Entered by the user |

- **Planned trip:** a vehicle, an origin and destination, a departure time and the chosen path. It keeps every candidate and gets a name like "Lima → Huancayo · 18 oct 06:00". A vehicle can have several planned trips.
- **Flota** (`/dashboard/fleet`): planned trips grouped by vehicle, with a filter for one vehicle. Each row shows the route, the departure, the chosen path with its SUTRAN or ILLAPA badge, its level and recommendation, and when it was last evaluated.
- **Trip detail** (`/dashboard/fleet/viajes/$tripId`): every candidate with its stored score. **Volver a evaluar** rescores them, and you can switch the chosen path or cancel the trip. **Iniciar viaje** starts a planned trip of a GPS vehicle: the trip becomes active, so the truck's progress and hazard alerts follow the chosen path (the demo trucks move along it). A vehicle has one active trip at a time. Completing a trip stays with the GPS flow.
- **Flota** has no map: the Mapa page already shows the fleet.

## Who builds what

- **Web** (review-route space): Revisar ruta at `/dashboard/revisar-ruta`, Agregar vehículo, Flota and the trip detail. It runs on realistic Lima to Huancayo fixtures until the API lands.
- **Backend** (Owen): the route review endpoint, vehicles with a type and axles, planned trips (departure time, explicit origin, several per vehicle), reading the axle limit from SUTRAN's detour data, the AI text and the demo login.
- **Shared:** the web side writes the contract as zod schemas in `packages/api`. The vehicle catalogue and the city list live in `packages/business`.

## Done when

- The Lima to Huancayo check runs end to end on live data.
- Every signal shows its source and when it was observed.
- Confirmed, forecast and baseline signals look different on the map and in the list.
- Risk levels always carry a text label, never color alone.
- SUTRAN detours stand apart from ILLAPA's paths, and detours over the vehicle's axle limit say why they're excluded.
- A planned trip shows up on Flota under its vehicle, and its detail page can rescore it.
- Each rule in the table has a passing test case.
- The UI is in Spanish by default, with English available.

## Demo and access

- illapa.app is a public landing page with a Probar demo button.
- The button calls a public auth endpoint that signs the visitor into one shared demo account, so judges never type a password. Owen builds it.
- An En vivo / Escenario toggle switches between live data and a replay of a real past rain event on the Lima to Huancayo trip. It isn't part of the review-route work, and its owner is still open.
- Reset the demo account's data before the pitch.
- Real users sign in with the existing better-auth email and password login.

## If time, in this order

1. Map layer of emergency and supply points: police, fire, health, bus terminals, weigh stations and INDECI warehouses. Already scraped.
2. An alert when a planned trip's level changes.
3. Incident feed that shows confidence, from unverified news to official confirmation.
4. WhatsApp or email alerts.

## Out of scope

AR/XR simulations, the native app, planning several vehicles in one review, and demo corridors beyond Lima to Huancayo.

## Open questions

- Which past rain event on the Lima to Huancayo trip the Escenario mode replays.
- Score thresholds for the four levels, set after the backtest.
- Organizations: every fleet endpoint on main needs an active organization, but the PRD planned individual accounts. Owen decides, together with the demo login.
- Routing for ILLAPA's own paths: OSRM, which main uses today, or the road graph in MySQL that the predictive model plans.
