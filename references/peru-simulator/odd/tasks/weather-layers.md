# Feature: weather-layers

## Objective
Add four independent real-data weather layers (rain, thunderstorms, animated wind, temperature) to the Peru 3D terrain app, plus a layer selector, per-layer opacity, time controls, and data provenance (source, UTC time, age).

## Constraints
- Open data only, no API keys. Verified 2026-10-17:
  - GFS 0.25°: `https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.YYYYMMDD/HH/atmos/gfs.tHHz.pgrb2.0p25.fFFF` + `.idx` (byte-range subsetting). Fields present: `TMP:2 m above ground`, `UGRD/VGRD:10 m above ground`, `PRATE:surface`, `APCP:surface`, `CAPE:surface`.
  - GLM-L2-LCFA: `https://noaa-goes19.s3.amazonaws.com/GLM-L2-LCFA/YYYY/DDD/HH/` (~450 KB per 20 s file).
- IMERG raw data requires a NASA Earthdata login → deferred by user decision (task P1).
- Existing app is custom Three.js (no Leaflet/MapLibre); keep basemap, terrain LOD, clouds intact.
- GRIB2/NetCDF processed by a Python backend (uv); grids reprojected to EPSG:3857 over Peru bounds.
- No fictitious animation; every layer georeferenced; respect provider terms (NOAA open data, attribution).

## Tasks
- [x] T1 Weather backend service (fetch, cache, per-product refresh, error handling, /api endpoints) + layer selector / opacity / time controls / provenance UI + temperature layer (GFS TMP 2 m, °C gradient, legend, point query) (route: delegated, writer trigger: 2+ non-trivial files) — commits `a2c15cf` (backend), `e71cde3` (framework + temperature)
- [x] T2 Wind layer (GFS U/V 10 m, GPU particle animation in the terrain frame, speed color, km/h + direction query) (route: delegated, writer trigger: 2+ non-trivial files) — commits `7165409` (backend), `4003b0e` (particles + controller bindings)
- [x] T3 Rain layer (GFS PRATE mm/h and APCP accumulated, intensity palette, transparent no-rain, clearly labelled "Forecast") (route: delegated, writer trigger: 2+ non-trivial files) — commits `579d643` (backend), `8af8ae8` (rain drape + legend + controller)
- [x] T4 Storms layer (GLM-L2-LCFA lightning markers/clusters "Observed" + GFS CAPE convective potential "Forecast potential", separate toggles) (route: delegated, writer trigger: 2+ non-trivial files) — commits `b4d2814` (backend), `b040066` (storms UI + drapes)
- [ ] P1 (pending, blocked on user) IMERG observed precipitation — needs NASA Earthdata credentials

## Acceptance criteria
- Each layer implemented and verified separately; existing tests stay green; `npm run build` passes.
- Observed vs forecast always labelled; source, UTC issue/obs time and data age visible.

## Delivery strategy
ask-on-risk; forecast > 400 authored lines; work stays on `feat/peru-3d-terrain` with work-unit commits; PR slicing decided when the user asks for PRs.

## Progress
T1-T4 complete on `feat/peru-3d-terrain` (not pushed). Remaining: P1 (blocked on Earthdata credentials). The parent's backend on 8787 must be restarted to serve `gfs-cape` and `glm-lightning` (new code + h5py dependency).

### T4 verification evidence (2026-10-18 00:3x-00:5x UTC)
- RED observed first: pytest collection errors (missing `weather.glm`, `weather.lightning`, `CAPE_SURFACE`); Vitest `lightning.test.ts` / `cape.test.ts` failing on missing modules. GREEN: pytest 84 passed (62 + 22: GLM key/listing/packed-variable parsing on a synthetic h5py NetCDF, quality filter, Peru crop, clustering, backfill/incremental/prune with a mocked S3 listing, cache restore, coverage, stale on failure, bad file skipped, API; CAPE selector f000/f003/f024/f048, average rejected, refresh + point), Vitest 21 files / 151 tests, `npm run clouds:test` 12 passed, `npm run build` OK.
- Real GLM file inspected (`OR_GLM-L2-LCFA_G19_s20262910000000...nc`, 425 KB): flash_* packed uint16-as-int16 with scale/offset/_Unsigned, time units `seconds since 2026-10-18 00:00:00.000`, quality flags {0, 3}; 33 good+degraded flashes in the Peru+2° box in that 20 s file.
- Real CAPE inventories (gfs.20261017/18): `CAPE:surface:anl` (f000) and `CAPE:surface:N hour fcst`, plus 180-0/90-0/255-0 mb mixed-layer CAPE (excluded).
- Own backend on 8791 (own cache, processed GFS products seeded): `gfs-cape` cycle 2026101718, 17 frames, 9.9 MB, 10.9 s; valueRange 0-3550 J/kg. Max per frame: f000 3550 J/kg at (0.52, -69.52), f003 3410 (0.98, -68.27), f021 2478 (-9.48, -72.47), f024 3120 (-9.02, -74.77), f048 3402 (-9.99, -74.97); clear diurnal cycle over the selva (>=1000 J/kg 15-26 % at 18-21 UTC vs ~0 % at 06-15 UTC). Point (-9.02, -74.77) f024 = 3119.6 J/kg.
- GLM cold start: 177 files, 70.7 MB, 14.4 s, 4658 good-quality flashes in Peru+2° in the last 60 min; then +3-4 files (1.1-1.5 MB) per minute; obsTime 00:43:40 with age 52 s; 178 files in window, 0 skipped. Clusters (100 km): top cells (-1.46, -68.49) 438 flashes, (-4.26, -72.26) 321 (Loreto); consistent with the high f000/f003 CAPE in the NE. `/api/lightning` payload ~133 KB for ~4.5k flashes.
- Headless Chrome 155 (SwiftShader, own profile, CDP 9371, own Vite 5179 -> 8791): Storms group with "Lightning (observed)" (OBSERVED) and "Convective potential (forecast)" (FORECAST) sub-toggles; lightning alone: clusters with counts over the Peru view, timeline hidden, legend "Last 60 min · until 00:44 UTC · 4,457 flashes" with age ramp, provenance "Last 60 min · latest file ... · Data age 57 s"; zoomed (~120 km) single flashes; click (-13.945, -72.448) -> "232 flashes within 20 km in the last 60 min · latest 00:51 UTC (2 min ago)" (backend recount 2 min later: 222, latest 00:51:35). CAPE alone at +18h/+24h: hatched lavender/violet/magenta, transparent below 250, legend + "Potential, not observed storms"; click (-9.200, -74.283) +24h -> "1,470 J/kg · moderate potential (forecast)"; (-11.022, -72.928) +18h -> 124 J/kg (backend 123.8). Lightning + CAPE + rain together and CAPE + temperature: all visible, toggles independent, readout lists each layer. Dead backend (Vite 5180 -> 8799): both storms rows "Backend unavailable", disabled. No shader errors or exceptions.
- Not observed live: the "No flashes in the last 60 min" state (Peru was active; it is the count-0 branch of the legend/status) and real-GPU performance (2048² canvas re-upload every 200 ms while flashes < 2 min old exist).

### T4 design notes
- Lightning is not a ProductSpec: `LightningService` (backend) and a separate feed in `WeatherController` (polls `/api/lightning` every 60 s while on). The catalog entry has `times: []`, so it never touches the forecast timeline; the legend carries its own "Last N min" label.
- Markers are drawn with Canvas 2D into a grid-space texture over the view footprint (reusing `footprintUv`/`chooseTrailRect` with a larger shrink ratio) and draped in the terrain shader: exact on the surface, no height sampling. Marker size and clustering follow the ground width at the view center; cluster cells = 1/24 of it above 300 km. Tradeoff: close oblique views get soft markers (one texel ~ region / 2048).
- CAPE uses a third drape slot without a palette texture (categories and hatching are generated into the shader from `domain/cape.ts`), keeping the fragment shader at 14 samplers (WebGL2 guarantees 16). `DrapeSlot.palette/range` are optional for that reason.
- Commits exceed the ~400-line heuristic (1118 / 1195 incl. ~450 test lines) because each is one coherent behavior with its tests.

### T1 verification evidence (2026-10-17)
- Backend live (`npm run weather`, port 8787): chose cycle 2026101718 (f048 idx present at 23:43 UTC), 17 frames f000-f048, 10.45 MB downloaded (17 TMP range requests ~0.5 MB + idx), 6.5 s. `/api/layers`: status ready, issueTime 2026-10-17T18:00:00Z, valueRange -2.1..40.2 °C, grid 256x348, nextRefresh 2026-10-18T04:00:00Z.
- Point queries (f006, valid 2026-10-18 00:00 UTC): Lima (-12.05,-77.04) 20.57 °C; Puno (-15.84,-70.02) 11.31 °C; f015 (09 UTC): Lima 19.40 °C, Puno 4.28 °C.
- Tests: backend pytest 28 passed (written alongside the code, no separate RED); Vitest RED observed (5 new test files failing on missing modules) then GREEN, final 15 files / 105 tests; `npm run clouds:test` 12 passed; `npm run build` OK.
- Headless Chrome 155 (SwiftShader, own profile, CDP port 9338, own Vite on 5174 proxying to 8787): clouds render unchanged; temperature gradient draped over terrain with legend, timeline and provenance; click at Lima -> 20.6 °C (client grid, matches backend 20.57), Lake Titicaca -> 12.2 °C; playback advances frames; no shader errors or exceptions. Vite on 5175 proxying to a dead port -> temperature row "Backend unavailable (start it with npm run weather)", toggle disabled, timeline hidden, clouds unaffected.

### T2 verification evidence (2026-10-17)
- RED observed first: pytest collection error on missing `weather.wind` / `encode_bands`; Vitest 2 new files failing on missing modules. GREEN: pytest 47 passed (28 + 19 wind), Vitest 18 files / 127 tests, `npm run clouds:test` 12 passed, `npm run build` OK.
- Own backend on 8788 (separate cache): `gfs-wind10m` cycle 2026101718, 17 frames; UGRD+VGRD messages ~0.9 MB each, 31 MB raw per cycle; 15.9 s (concurrent with t2m). Grid 256x348 x 2 bands = 348 KB per frame. Catalog: valueKind vector, bands [u, v], units m/s, valueRange (speed) 0.0-14.2 m/s.
- Point queries f006 (2026-10-18 00 UTC): Lima 9.39 km/h from S (176°); Puno 12.6 km/h from SSE (153°); off Piura (-5.2, -81.2) 27.2 km/h from S (184°): southerly coast-parallel flow as expected along Peru's coast (SE trades / Humboldt current regime); Iquitos 2.8 km/h.
- Headless Chrome (own profile, SwiftShader, CDP 9347, own Vite 5176 -> 8788): particles stream NW along the coast at the full-Peru view (animation x10k); at Lima streaks follow the southerly flow and lie on the relief; click at Lima -> "9 km/h from S (177°)" (matches backend); temperature + wind together -> both values in the readout; Lake Titicaca -> 12.1 °C, 14 km/h from SSE (147°); clouds unchanged; no shader errors or exceptions; dead backend -> wind and temperature "Backend unavailable", disabled. FPS 1-3 on SwiftShader with or without wind (terrain bound), so the particle cost is not measurable there; real-GPU FPS unverified.

### T3 verification evidence (2026-10-17)
- RED observed first: pytest collection error on missing `weather.precip`; Vitest `rain.test.ts` failing on the missing module; then real data exposed a second RED (`LookupError: APCP ... ^0-24 hour acc` — wgrib2 writes `0-1 day acc`), covered by new f024/f048 idx cases before the fix. GREEN: pytest 62 passed (47 + 15 precip), Vitest 19 files / 138 tests, `npm run clouds:test` 12 passed, `npm run build` OK.
- Real-data cross-check (cycle 2026101718): (APCP[0-9] - APCP[0-6]) / 3 vs `PRATE 6-9 hour ave` x 3600 max |diff| 0.023 mm/h; f006 diff vs 2*ave(0-6) - ave(0-3) max 0.026 mm/h.
- Own backend 8789 + cold-cache run on 8790 (`WEATHER_PRODUCTS=gfs-precip`): 17 frames, 9.3 MB downloaded (16 APCP running totals ~0.4 MB + PRATE anl 0.69 MB + idx), 5.0 s, 17 raw messages (each shared message fetched once). Frame 356,352 B (256x348 x 2 bands). Catalog: kind forecast, units mm/h, bands [rate, accum], bandRanges rate 0-36.1 mm/h, accum 0-155 mm, metadata.bands definitions.
- Max rate over the Peru bbox per frame (mm/h): f000 3.5, f003 7.7, f006 10.5 (-6.75, -74.51, Ucayali selva), f009 2.1, f012 2.1, f015 2.8, f018 2.3, f021 2.5, f024 2.9, f027 5.3, f030 9.6, f033 12.6, f036 9.5, f039 36.1 (-0.99, -79.5, Ecuador coast inside the bbox), f042 22.9, f045 4.4, f048 6.0; wet (> 0.1 mm/h) share 12-36 %.
- Point queries: (-6.75, -74.51) f006 rate 10.33 mm/h, accum 32.99 mm; Lima f006 0.0 / 0.0, f048 0.0 mm/h / 0.022 mm; (-9.2, -75.0) f006 0.194 mm/h, 2.944 mm.
- Headless Chrome 155 (SwiftShader, own profile, CDP 9360, own Vite 5178 -> 8789): rain blobs over the selva with blue/green -> yellow/red cores, transparent elsewhere; legend "Forecast precipitation — GFS (mm/h)" + FORECAST badge + Rate/Accumulated switch; provenance "Precipitation (forecast)" FORECAST with the model-forecast note; click (-9.2, -75.0) -> "0.2 mm/h (forecast)", accumulated mode -> "2.9 mm accumulated since 2026-10-17 18:00 UTC" (matches backend); rain + temperature together -> "23.5 °C" and "0.2 mm/h (forecast)", both drapes visible; wind particles and clouds unchanged; no shader errors or exceptions.

### T3 design notes
- One product, two bands (`rate`, `accum`): same messages and time axis, so one download per frame and a client-side mode switch. Rate = mean over (previous served fhour, fhour] from APCP running totals (uniform, unlike the alternating 3 h / 6 h buckets); f000 = instantaneous PRATE analysis (per-frame `rate.method`). An observed product (IMERG, P1) can reuse the two-band shape with `kind: "observed"` and a separate binding/badge.
- Backend: `ProductSpec.deriver` (inputs from several forecast hours + band builder + frame metadata) generalizes beyond single-field products; `FieldSpec.key` includes the forecast regex when set (raw cache), in-flight raw downloads are deduplicated; catalog adds `metadata` and `bandRanges`; point responses add `kind` and `bands`.
- Frontend: `ScalarDrape` takes a `DrapeSlot` (`scalarSlot`/`rainSlot`); the shader has a generic `drape()` and composites rain over temperature. Rain values are mapped to threshold-index space on the CPU (`rainIndexGrid`), so one 0..7 alpha palette serves both modes. Commits exceed the ~400-line heuristic (458 / 603 incl. ~280 test lines) because each is one coherent behavior with its tests.

### T2 design notes
- Particles are drawn into a grid-space trail texture draped by the terrain fragment shader (not 3D lines), so they never float or get buried and need no height data; the region follows the view footprint (hysteresis, resampled trails), giving zoom-adaptive density. Trail texels can look blocky in very close oblique views (one trail texel ~100 m at 20 km altitude).
- `ProductBinding` in `weather-controller.ts` generalizes layers (cache + view + readout formatter); T3/T4 add a binding plus a view. `GridCache` is generic over the fetcher; `parseWeatherGridMeta` handles band-sequential multi-band grids (`bands`).
- Backend products can have extra bands (`extra_bands`, `value_kind`); per-product download bytes are now counted per refresh (products refresh concurrently).

### T1 design notes / extension points for T2-T4
- Backend products: add a `ProductSpec` to `services/weather/weather/products.py` (field selector with optional forecast regex, e.g. PRATE `ave fcst`, `f000_field` for fields without an analysis) and enable it via `WEATHER_PRODUCTS`. Vector wind (U+V) needs a two-field product (extend `_build_frame` to fetch several FieldSpecs and encode 2 bands).
- Frontend: `LAYER_DEFINITIONS` (`src/domain/weather-layers.ts`) flags `implemented`/`productId`; `WeatherController` wires toggles, timeline, provenance and point queries. The terrain shader has one draped scalar slot (`uScalar*`, RGBA palette so rain can be transparent at 0); a second simultaneously draped layer (rain + temperature) needs a second slot.
- Limitations: mobile hides the legend/provenance dock (badges and status rows stay); ray-march pick assumes slopes the 0.2 step factor can follow.
