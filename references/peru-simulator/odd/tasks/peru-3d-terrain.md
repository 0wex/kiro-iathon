# Feature: peru-3d-terrain

## Objective
Web app to navigate Peru in 3D using Tilezen elevation tiles (the heightmapper dataset), streamed as quadtree LOD tiles for performance.

## Constraints
- Data: AWS open data `elevation-tiles-prod` — GeoTIFF (`/geotiff/{z}/{x}/{y}.tif`, default, as requested) and Terrarium PNG (`/terrarium/...`, lighter fallback). CORS verified.
- Never render everything at once: screen-space-error quadtree, frustum culling, request queue with cancellation, LRU cache with GPU disposal, worker decoding.
- Stack: Vite + TypeScript + Three.js + geotiff.js + Vitest.

## Tasks
- [x] T1 Scaffold (Vite/TS/three/vitest), domain tile math + LOD selection with unit tests (route: delegated, writer trigger: 2+ non-trivial files) — commit `e789dd1`
- [x] T2 Tile loading infra: worker decode (GeoTIFF/Terrarium), request scheduler, LRU cache (route: delegated writer) — commit `476223e`
- [x] T3 Rendering: shared-geometry tile meshes with skirts, imagery/hypsometric shading, controls + HUD (route: delegated writer) — commit `dc08d89`
- [x] T4 Smooth LOD transitions: geomorphing, imagery cross-fade, hysteresis, prefetch (route: delegated, writer trigger: 2+ non-trivial files) — commit `dc4b5c3`
- [x] T5 Fix tile cache churn: keep the LOD working set cached, budget the working set, half-float heights (route: delegated, writer trigger: 2+ non-trivial files) — commit `ad85afb`
- [x] T6 Cloud layer from NOAA GOES-19: ACMF cloud mask + CMIPF C13 IR -> Web Mercator PNG pipeline (uv/Python), 3D stacked cloud sheets, terrain cloud shadows, toggle/opacity/scan time, 10-min polling (route: delegated, writer trigger: 2+ non-trivial files) — commits `8ba8ff9` (pipeline), `97c520f` (app layer)

## Acceptance criteria
- `npm run build` and `npm test` pass.
- Opening the app shows Peru terrain; tiles refine as camera approaches; tile count/requests stay bounded.

## Delivery strategy
ask-on-risk. Forecast ~1200 authored lines.

## Progress
All tasks (T1-T6) complete on `feat/peru-3d-terrain` (not pushed).

### Verification evidence
- T1 RED: `npx vitest run` failed with 4 test files unable to import missing modules; GREEN: 31/31 tests passed (one test expectation arithmetic fixed: 150*256+184+0.5-32768 = 5816.5).
- T2 RED: 3 new infra test files failed on missing modules; GREEN: 46/46 tests passed.
- Real tile probe: `geotiff/10/302/556.tif` is 512x512, 1 sample, 16-bit signed Int16 (SampleFormat 2), nodata -32768. App decoder on `geotiff/12/1222/2199.tif` (Machu Picchu) -> Float32Array 512x512, min 1623 m, max 4314 m.
- T3: `npm test` 7 files / 46 tests passed; `npm run build` (tsc --noEmit + vite build) succeeded; `vite preview` served index with HTTP 200.
- Headless Chrome (SwiftShader) runs: overview of Peru, Machu Picchu close-up (127 visible tiles, caches bounded at 220 height / 250 imagery, 0 in flight after settling), Terrarium + hypsometric at Huascarán; no shader or runtime errors in the console.

- T4 RED: new lod/tile-math tests failed (`screenSpaceError`/`ancestorUvTransform` missing; lod.test.ts could not load); GREEN: 60/60. Prefetch-budget TileLayer test RED (1 failed) then GREEN 62/62; the spare-slot prefetch test was added together with its implementation (no separate RED). Final: `npm test` 7 files / 63 tests passed; `npm run build` succeeded.
- T4 headless Chrome (SwiftShader, own profile, port 9337, against the running dev server): overview, Machu Picchu jump and fly-mode W flight render with no shader compile errors or exceptions; coarse ancestors cover loading areas without holes. Pop smoothness itself cannot be judged at SwiftShader frame rates (1-9 FPS).
- T4 finding: at the Machu Picchu view the baseline (pre-T4) already re-downloads ~9 tiles/s at steady state (160 visible tiles vs 220 height-cache capacity; ready-but-undisplayed siblings of incomplete refinements get evicted). First prefetch version added 32 more queued requests to that churn; prefetch is now limited to spare request slots and cache headroom, restoring baseline queue numbers (queued 5, in flight 8).

- T5 diagnosis (headless Chrome 155, SwiftShader, own profile, 1280x800, Machu Picchu jump, still camera, 60 s settle): 62 elevation requests in 11.3 s (5.5 req/s); instrumented LRU showed all 68 loads in the window were re-loads of keys evicted earlier, none of them in the current `requests` list. Evicted keys were ready-but-undisplayed working-set tiles: ancestors of displayed tiles (z5 root, z11, z12) and z13 children of incomplete refinements. Full working set at that view (every visited tile, requested whenever missing) = 233 tiles (+32 prefetch) vs 220 height-cache capacity, while only the 160 displayed tiles were pinned. Root cause: `TileLayer` pinned only displayed tiles, but `selectTiles` re-requests every visited tile that is missing, so evicting ancestors/siblings looped. At 800x500 the working set (179) fit and there was no churn.
- T5 fix: `selectTiles` returns `needed` (working set) and takes `maxTiles` (refines in decreasing-SSE order until the budget is met); ready prefetch candidates are now listed so caches keep them. `TileLayer.update(requests, retain)` never evicts retained tiles, only downloads needed tiles into capacity left beside them and prefetches into the remaining headroom. Heights are half-float (R16F) relative to the tile minimum (worker-side `encodeHalfHeights`), so height cache 220 -> 400 tiles at ~200 MB (was ~220 MB); imagery 320 -> 360; LOD budget 300.
- T5 RED: new lod tests failed (`needed` undefined), TileLayer capacity/no-thrash tests failed (5 loads instead of 3; `needed` missing), half-float test failed (module missing); one new TileLayer test (retained undisplayed tiles survive) passed already because the old `displayed` argument was also the pin set. GREEN: `npm test` 8 files / 72 tests; `npm run build` succeeded.
- T5 headless after fix (same setup): 1280x800 -> 0 elevation + 0 imagery requests in 10 s after settling, 160 visible tiles (unchanged), 274 heights cached, 0 queued / 0 in flight, 0 evictions; 2560x1600 (budget active, working set 298) -> 0 requests in 10 s, 204 visible tiles; Terrarium source switch loads and samples Machu Picchu at 2440 m; no shader errors or exceptions.

- T6 scope: user switched the alpha source from CMIPF IR to ABI-L2-ACMF (cloud mask) with a "TV weather" look. ACMF variables confirmed by inspection: BCM, ACM (4-level), Cloud_Probabilities (uint16, scale 1.526e-5, fill 65535), DQF (0 good, 1 bad, 2 space, 6 degraded). Opacity uses Cloud_Probabilities (continuous, soft edges) with ACM as fallback; DQF 1/2 and fills are masked. CMIPF C13 (same scan, same 5424x5424 grid, CMI int16 `_Unsigned`) shapes brightness/opacity and relief texture; default on, `--no-ir` to skip.
- T6 RED: pytest collection failed (`goes_clouds` missing) and Vitest `cloud-overlay.test.ts` failed (module missing); projection/style tests were written together with their modules. GREEN: `npm run clouds:test` 12 passed; `npm test` 9 files / 80 tests; `npm run build` succeeded.
- T6 `npm run clouds` (real data): mask `ABI-L2-ACMF/2026/290/23/OR_ABI-L2-ACMF-M6_G19_s20262902300207_...nc`, IR `ABI-L2-CMIPF/2026/290/23/OR_ABI-L2-CMIPF-M6C13_G19_s20262902300207_...nc`; cold run 15.1 s (download 12.2 s for 26.0 + 24.0 MB, process 1.4 s), cached 4.4 s; 2048x2785 LA PNG 3.04 MB; alpha>0.1 coverage 77.5 %, mean alpha 0.337; source window rows 2599:3804, cols 2245:3179.
- T6 known points: PUG worked example (x -0.024052, y 0.095340 <-> 33.846162 N, 84.690932 W) round-trips to 1e-6 rad; Lima -> scan (-0.006185, -0.036789) = full-disk col 2601.1 / row 3368.5, output px (775.0, 1723.3), matched by the TS `localToCloudUv` test; reprojected C13 crop of Lake Titicaca shows the warm lake inside a hand-drawn lon/lat outline; overview screenshot shows the Pacific stratocumulus edge following the Peruvian coast.
- T6 headless Chrome (SwiftShader, own profile, port 9337, dev server): overview shows soft white clouds over the Andes and Amazon with HUD "Clouds 2026-10-17 23:00 UTC" and panel "Scan ... ABI-L2-ACMF mask + C13 IR"; Titicaca and Machu Picchu jumps render with no shader errors or exceptions. Sample committed as `public/clouds/sample.png` (1536 px, 1.93 MB); `latest.*` (3.04 MB at 2048 px) is gitignored.

### Known limitations
- Geomorph and cross-fade are per tile: neighbouring tiles with different morph factors can differ along shared edges (hidden by skirts). At morph 0 a child samples its own finer DEM at even vertices, not the parent's texture, so tiny height differences remain.
- Imagery cross-fade only applies when a tile replaces a displayed ancestor (refinement); coarsening swaps imagery instantly. Imagery never arrives after heights for a displayed tile (display requires both), so no separate late-imagery fade exists.
- When the LOD tile budget (300) binds, distant areas stay one level coarser than the SSE target; the budget refines by largest SSE first and stops at the first refinement that does not fit.
- Switching elevation source clears height tiles, so the view is briefly empty until root tiles reload.
- Height textures are half-float relative to the tile minimum (0.5 MB per GeoTIFF tile): error <= 0.5 m for tiles with < 2048 m relief, up to 2 m for coarse tiles with 4096-8192 m relief. The CPU sampler (camera ground clamp) reads the same half-float data, so it matches the rendered surface with the same tolerance (well below the 30 m clearance).
- Adjacent tiles sample edge texel centers, so seams are hidden by skirts rather than stitched exactly.

- Clouds are flat sheets at a fixed 7-9 km altitude (times exaggeration), not per-pixel cloud-top heights; low marine stratus is drawn at the same altitude, only greyer and more translucent. Cloud shadows use the sheet base height and a single fixed sun direction (not the real sun position at scan time).
- The first sample was generated at dusk (23:00 UTC); ACMF is valid day and night, but IR texture shows less contrast for warm low cloud.
- The 10-minute poll path (texture swap + dispose) was not exercised live; the dark Titicaca lake and pale cross-fading tiles seen at that jump are present with clouds off too (imagery, not this task).

### Next step
Manual exploration on real GPU hardware; optional detail (SSE) slider and camera-relative rendering if precision issues appear.
