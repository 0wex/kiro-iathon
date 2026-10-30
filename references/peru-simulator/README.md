# Peru 3D Terrain

Navigate Peru in 3D using the open [Tilezen / AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) elevation dataset (the same data as [heightmapper](https://tangrams.github.io/heightmapper/)), streamed as a quadtree of LOD tiles.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (vitest)
npm run build    # type-check + production build
npm run clouds   # fetch the latest GOES-19 cloud image (needs uv)
npm run weather  # weather layer backend on :8787 (needs uv); Vite proxies /api to it
npm run weather:test
```

## Controls

- **Orbit** (default): drag to pan, right-drag to rotate, scroll to zoom.
- **Fly**: WASD to move, Q/E down/up, Shift to boost, drag to look.
- Panel: cloud layer toggle, opacity and scan time; elevation source (GeoTIFF 512 px Int16 / Terrarium 256 px PNG), shading (Esri imagery / hypsometric), vertical exaggeration, quick jumps.

## Architecture

| Layer | Responsibility |
| --- | --- |
| `src/domain` | Pure logic: Web Mercator tile math, local metric frame, Terrarium decoding, screen-space-error quadtree selection with parent fallback. No Three.js or DOM. |
| `src/infrastructure` | Tile sources, decoder Web Worker pool (transferable buffers), priority request scheduler with `AbortController` cancellation, LRU cache that disposes evicted GPU resources and never evicts the LOD working set (displayed tiles, their ancestors and children of incomplete refinements). |
| `src/rendering` | One shared grid geometry with skirts; heights from a per-tile half-float (R16F) `DataTexture`, stored relative to the tile minimum, displaced in the vertex shader; normals, imagery/hypsometric shading and fog in the fragment shader; logarithmic depth. |
| `src/ui` | HUD, control panel, fly controls, styles. |
| `src/app.ts` | Composition root: camera, controls, LOD loop. |

### Performance model

- Only tiles selected by the quadtree are requested; LOD recomputes only when the camera moves, the viewport changes or a tile arrives (throttled to 20 Hz).
- Requests are coarse-first, then nearest-first, at most 8 elevation + 6 imagery in flight; tiles that leave the wanted set are aborted.
- While children load, their ready parent is drawn, so no holes appear.
- Smooth LOD transitions: per-tile CDLOD-style geomorphing (odd grid vertices start on the parent's coarser surface and morph to full detail as the parent's screen-space error grows), a 300 ms imagery cross-fade from the replaced ancestor, refine/coarsen hysteresis (refine above the SSE threshold, coarsen below 0.75x) and low-priority child prefetch above 0.7x that only uses spare request slots and cache headroom.
- Caches are bounded (400 height / 360 imagery tiles); evicted textures are disposed. The LOD working set is capped at 300 tiles (largest screen-space errors refine first), so it always fits the caches and a still camera issues no requests once settled. Pixel ratio is capped at 2.

## Cloud layer (NOAA GOES-19)

`npm run clouds` runs `scripts/clouds/goes_clouds.py` through [uv](https://docs.astral.sh/uv/) (numpy, h5py, Pillow; no GDAL):

1. **Download**: lists the public `noaa-goes19` S3 bucket (no credentials) for the newest `ABI-L2-ACMF` full-disk clear-sky/cloud mask (every 10 min, ~26 MB), walking back across empty hours, plus the `ABI-L2-CMIPF` band 13 (10.3 µm clean IR, ~24 MB) file of the same scan. Files are cached by name in `scripts/clouds/.cache/` (gitignored, last 6 kept).
2. **Extract**: `Cloud_Probabilities` (continuous 0..1; falls back to the 4-level `ACM` mapped to 0 / 0.15 / 0.6 / 1) and the IR brightness temperature. `DQF` bad-quality and space pixels and fill values are masked; only the source rows/columns covering Peru are decompressed.
3. **Transparency / TV look**: probability -> opacity ramp (0.30..0.85); colder IR tops become brighter and more opaque, warm low cloud greyer and more translucent; the cold-top field is relief-shaded for internal texture and everything is Gaussian-softened so 2 km pixels never look blocky. `--no-ir` skips the second download (mask-only look).
4. **Reproject**: own implementation of the GOES-R ABI fixed-grid projection (PUG vol. 3 §4.2.8): every Web Mercator output pixel -> lon/lat -> scan angles -> bilinear source sample. Output covers `PERU_BOUNDS` (read from `src/domain/peru.ts`) plus a 2° margin, 2048 px wide.
5. **Export**: `public/clouds/latest.png` (grey + alpha) and `latest.json` (scan time, source keys, mercator/lon-lat bounds, size). Both are gitignored; a committed `sample.png/json` (1536 px) is used when no generated image exists.

Options: `npm run clouds -- --no-ir --width 2048 --margin 2 --blur 1.4 --ir-band 13`. Tests: `npm run clouds:test` (pytest; projection checked against the PUG worked example). The 0.5 km visible band (C02, ~280 MB per full-disk file and dark at night) is not used.

In the app the image is drawn as three stacked transparent sheets at 7, 8 and 9 km (times the vertical exaggeration); denser cloud reaches the upper sheets, sheets fade when the camera is inside them or views them edge-on, and the terrain shader darkens ground under clouds along the sun direction. The app polls `latest.json` every 10 minutes and swaps the texture when the scan changes.

## Weather layers (NOAA GFS backend)

`npm run weather` starts `services/weather` (FastAPI + uvicorn via uv; ecCodes binary wheels `eccodes` + `eccodeslib` for GRIB2, no system libraries). The Vite dev/preview server proxies `/api` to it (`WEATHER_API_URL`, default `http://127.0.0.1:8787`). Without the backend the app still runs and the weather layers report "Backend unavailable".

1. **Cycle selection**: newest GFS 0.25° cycle (00/06/12/18 UTC, up to 4 back) whose `.idx` inventories exist for every configured forecast hour, so cycles still being published are skipped.
2. **Range download**: the `.idx` gives each message's byte range; only the needed message (e.g. `TMP:2 m above ground`, ~0.5 MB) is fetched with an HTTP `Range` request from `noaa-gfs-bdp-pds`. f000-f048 every 3 h = 17 messages, ~10 MB per cycle for TMP, ~31 MB for wind (UGRD + VGRD 10 m, ~0.9 MB each) and ~9 MB for precipitation (16 APCP running totals ~0.4 MB + one PRATE analysis, idx included). Retries with exponential backoff on 5xx/network errors.
3. **Grid**: decoded with ecCodes, bilinearly resampled to Web Mercator over `PERU_BOUNDS` + 2° (same extent as the cloud image), 256 px wide, row 0 north; converted to served units (K -> °C) and quantized to little-endian Uint16 with `scale`/`offset` (65535 = no data, ~0.7 mK steps). Vector products (wind) are two band-sequential Uint16 bands (`u`, `v` in m/s; u > 0 toward the east, v > 0 toward the north), each with its own `scale`/`offset` in `encoding.bands`; a cell missing in either band is no data in both. Frame metadata adds `bands` and `speedRange`. Derived products (precipitation) combine messages of several forecast hours; a message shared by two frames is downloaded once.
4. **Cache**: `services/weather/.cache/` (gitignored) holds raw messages (`raw/gfs/<cycle>/<field>_f<FFF>.grib2`) and processed grids with a per-cycle manifest written last; the newest complete cycle is restored on restart and the last 2 are kept.
5. **Refresh**: one scheduler per product sleeps until the next cycle is expected (cycle + 6 h + 4 h publish delay), then polls every 10 min; failures back off 1 -> 30 min while the last good data stays served (`status: stale`, `error` set).

| Endpoint | Returns |
| --- | --- |
| `GET /api/layers` | catalog: id, title, kind (observed/forecast), source, attribution, units, display/value range, status, error, issue time, age, last success/attempt, next refresh, times (`id`, `validTime`, `forecastHour`), grid geometry |
| `GET /api/layers/{id}/{time}/meta` | per-time metadata: valid/issue time, size, mercator and lon/lat bounds, encoding |
| `GET /api/layers/{id}/{time}/grid` | `width * height` Uint16 LE per band (ETag per run) |
| `GET /api/layers/{id}/point?lat=&lon=&time=` | bilinear value at a point (time id or ISO time; default nearest to now); wind returns `value` in km/h plus `u`, `v`, `speedMs`, `directionDeg` (meteorological: where the wind comes from, 0 = N, 90 = E) and `directionCompass` (16 points) |
| `GET /api/lightning?minutes=` | observed GLM flashes of the last `minutes` (capped to the rolling window), columnar: `lat`, `lon`, `age` (seconds before `windowEnd`, oldest first), `energyFj`; plus `windowStart`/`windowEnd`, `obsTime`, `coverageStart`, `count`, `bounds` |
| `GET /api/lightning/clusters?minutes=&cell_km=` | grid-binned flash counts (cells of ~`cell_km`, longitude scaled at the mean latitude): `lat`, `lon` (centroid), `count`, `latest` (ISO UTC), largest first |

**Precipitation** (`gfs-precip`, FORECAST) is one product with two bands, because both come from the same messages and share the time axis (the mode switch is client-side, no refetch):

- `rate` (mm/h): mean rate over the window between the previous served forecast hour and this one, `(APCP[0-N] - APCP[0-prev]) / (N - prev)`; with the default 3-hourly timeline this is the **3-hour mean rate ending at the valid time**. GFS buckets alternate 3 h / 6 h (`PRATE ... 6-9 hour ave` vs `6-12 hour ave`, `APCP 6-9 hour acc` vs `0-6 hour acc`), so the uniform APCP running total (`APCP:surface:0-N hour acc fcst`; wgrib2 writes whole days as `0-1 day acc`, `0-2 day acc`) is differenced instead; on real data this matches `PRATE` 3-h averages within 0.03 mm/h. Negative differences (packing noise) are clipped to 0. At f000 there is no window: the instantaneous `PRATE:surface:anl` (kg m⁻² s⁻¹ x 3600 = mm/h) is shown.
- `accum` (mm): APCP running total since the cycle start (0 at f000).

The catalog entry carries these definitions in `metadata.bands`, per-band ranges in `bandRanges`; frame metadata has `rate.method`/`rate.windowHours` and `accumulation.since`; the point endpoint returns `kind: "forecast"`, `value` (rate) and `bands: {rate, accum}`. An observed product (e.g. IMERG, task P1) can later use the same two-band shape with `kind: "observed"`.

**Convective potential** (`gfs-cape`, FORECAST): `CAPE:surface` (surface-based convective available potential energy, J/kg), one ~0.55 MB message per forecast hour (~10 MB per cycle). The selector is `^(anl|N hour fcst)$`: f000 is `CAPE:surface:anl`, later hours `CAPE:surface:N hour fcst` (verified in the 2026-10-17 18 UTC inventories; the `CAPE:180-0 mb above ground` / `90-0` / `255-0` mixed-layer messages are not used). It is a forecast potential for convection, not observed storms.

**Observed lightning** (`glm-lightning`, OBSERVED): NOAA GOES-19 GLM L2 LCFA (`https://noaa-goes19.s3.amazonaws.com/GLM-L2-LCFA/YYYY/DDD/HH/OR_GLM-L2-LCFA_G19_s…_e…_c….nc`, one NetCDF4/HDF5 file per 20 s, ~0.4 MB, full disk), read with h5py. Only flashes are used (`flash_lat`, `flash_lon`, `flash_time_offset_of_first_event` + the epoch in its `units`, `flash_energy`, `flash_area`; packed unsigned int16 with `scale_factor`/`add_offset`), filtered to `flash_quality_flag == 0` (good quality) and cropped to `PERU_BOUNDS` + 2°. A rolling window (default 60 min) is kept: every minute the service lists the bucket's hour prefixes overlapping the window (S3 `ListObjectsV2`, final listings of past hours cached), downloads only files it has not seen, and prunes files that left the window from memory and disk. The cropped flashes of each file are cached as a small `.npz` in `<cache>/glm/` (the raw file is not kept), so restarts reuse them. Volume: ~180 files / ~75 MB per hour of data (measured cold start: 177 files, 70.7 MB, 14 s; then ~3 files / ~1.2 MB per minute); unreadable files are skipped and not retried. The catalog entry has `kind: observed`, `valueKind: events`, `obsTime` (end of the newest file), `ageSeconds`, `windowMinutes`, `coverageStart` (later than the window start while backfilling), `flashCount`, `times: []` (it never joins the forecast timeline).

Settings (environment): `WEATHER_FHOURS` (`0-48:3`), `WEATHER_PRODUCTS` (`gfs-t2m,gfs-wind10m,gfs-precip,gfs-cape`), `WEATHER_GRID_WIDTH` (256), `WEATHER_MARGIN` (2), `WEATHER_CACHE_DIR`, `WEATHER_REFRESH=0` (serve the cache only), `WEATHER_LIGHTNING=0` (disable observed lightning), `WEATHER_GLM_WINDOW_MIN` (60), `WEATHER_GLM_BACKFILL_MIN` (60; cold-start backfill, at most the window), `WEATHER_GLM_POLL_S` (60), `WEATHER_GLM_BASE_URL`.

In the app, **Weather layers** in the panel lists Clouds, Rain, Storms, Wind and Temperature with an Observed/Forecast badge, toggle, opacity and status; Storms is a group with two independent sub-layers, **Lightning (observed)** and **Convective potential (forecast)**. Forecast layers share a bottom **timeline** (slider, play/pause at 1 time/s, valid time UTC and "Forecast +Nh from <run> UTC"); a **provenance** panel shows source, attribution, time and data age of every enabled layer. **Temperature** (GFS TMP 2 m) is sampled in the terrain fragment shader from an RG16F texture (value x validity, validity) through a 256-texel palette (blue -> cyan -> green -> yellow -> orange -> red over -10..40 °C), so it is exact for every LOD/geomorph state at no geometry cost, with a 350 ms cross-fade between times and a legend. Clicking the terrain ray-marches the CPU height sampler to lon/lat and shows the bilinear value of every enabled layer from the client-side grids (falling back to the point endpoint while a grid loads), e.g. `20.6 °C` and `18 km/h from SW (225°)`.

**Wind** (GFS UGRD/VGRD 10 m) is animated with GPU particles (`src/rendering/wind-layer.ts`): ~49k particles (16k on touch devices) live in a ping-pong RGBA32F texture as grid UV (+ age, lifetime) and are advected each frame by the bilinear U/V field (RGBA16F texture, 350 ms cross-fade between times) at real m/s times an animation speed-up; the mercator stretch (1 / cos lat) is applied so motion is in true meters (`advectUv` in `src/domain/wind-particles.ts` is the tested CPU reference of the shader). Particles respawn at random positions after a random 2.5-6 s lifetime, when they leave the region or reach no data. Each frame a line from the previous to the current position of every particle is drawn into a 2048² (1024² on touch devices) RGBA16F **trail texture in grid space**, after the previous trails are copied with exponential fading (half-life 0.35 s). The terrain fragment shader drapes that texture like the scalar layers, so streaks lie exactly on the rendered surface for every LOD, geomorph state and camera (orbit, fly, tilted) without any height lookup: no floating or buried particles. Trails are colored by speed (light blue -> green -> yellow -> red -> magenta over 0-100 km/h, legend in km/h). The particle/trail region follows the view footprint (screen rays against the ground plane, cut at the fog distance; square, with hysteresis and trail resampling when it changes), so density and streak width stay similar at every zoom; the speed-up scales with the region (a 10 m/s wind crosses ~4% of it per second) and is shown under the legend. Hidden or zero-opacity wind does no GPU work. Requires WebGL2 float render targets (`EXT_color_buffer_float`); otherwise the layer reports it and stays off.

**Rain** (`gfs-precip`) is draped through a second terrain shader slot (`uRain*`), composited over temperature, so both can be shown together. The selected band is mapped on the CPU to threshold-index space (`src/domain/rain.ts`): rate thresholds 0.1, 1, 2.5, 5, 10, 25, 50 mm/h, accumulation thresholds 0.5, 2, 5, 10, 25, 50, 100 mm, each one palette step, so the skewed intensity scale gets even color steps; the alpha palette is transparent up to the first threshold with a soft edge above it, light rain blue/green, moderate yellow, heavy orange/red, extreme magenta. The legend ("Forecast precipitation — GFS", FORECAST badge) has a **Rate (mm/h) / Accumulated (mm)** switch; the provenance entry says it is a model forecast, not observed rain. Point query: `2.3 mm/h (forecast)` or `14 mm accumulated since 2026-10-17 18:00 UTC`.

**Storms** are two clearly separated sub-layers:

- **Lightning (observed)** polls `/api/lightning` every minute while on. Markers are drawn with Canvas 2D into a 2048² (1024² on touch devices) grid-space texture over the view footprint and draped by the terrain fragment shader like the wind trails (premultiplied, composited last), so they lie exactly on the rendered surface for every LOD, geomorph state and camera with no height lookup. Wide views (> 300 km across) show grid-binned clusters (cells of 1/24 of the view) with flash counts; closer views show every flash as a dot with a small cross. Color and opacity encode real flash age (white-yellow now -> yellow 10 min -> orange, fading to the window end); flashes of the last 2 min get a pulsing ring timed by the wall clock (their real age, not a fake animation). Its legend has its own "Last 60 min · until HH:MM UTC" label, the flash count or "No flashes in the last 60 min over the Peru area", and is independent of the forecast timeline. Clicking reports the number of flashes within 20 km in the window and the most recent time, e.g. `232 flashes within 20 km in the last 60 min · latest 00:51 UTC (2 min ago)`. Limitation: one texel is ~region / 2048, so markers soften in close oblique views where the footprint reaches the fog distance.
- **Convective potential (forecast)** (`gfs-cape`) is draped through a third terrain slot (`uCape*`) composited over rain, on the forecast timeline. Instead of a palette texture it is colored in the shader from `src/domain/cape.ts` (keeps the fragment shader within the 16 texture units WebGL2 guarantees): transparent below 250 J/kg, then Marginal 250-1000 (lavender), Moderate 1000-2500 (violet), High ≥ 2500 (magenta), each with diagonal screen-space hatching that gets denser with the category, so it is not confused with rain (blue -> red fills) or lightning (white/yellow marks). Legend: "Convective potential (forecast) — GFS CAPE, J/kg", "Potential, not observed storms". Point query: `1,470 J/kg · moderate potential (forecast)`.

## Attribution

Elevation: Tilezen Joerd / AWS Terrain Tiles (Mapzen and its data providers). Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community. Clouds: NOAA GOES-19 ABI L2 products via the NOAA Open Data Dissemination program on AWS. Weather: NOAA/NCEP Global Forecast System (GFS 0.25°) via NOAA Open Data Dissemination on AWS. Lightning: NOAA GOES-19 Geostationary Lightning Mapper (GLM L2 LCFA) via NOAA Open Data Dissemination on AWS.
