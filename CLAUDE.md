# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Interactive map of Canadian police crime incidents, fetched **live** from public ArcGIS
FeatureServers in the browser. No backend, no API key, no database. SvelteKit 5 (runes) +
TypeScript + MapLibre GL, built as a static SPA (`adapter-static`, `ssr = false`) and deployed
to GitHub Pages. Currently covers GTA regions: Peel, Toronto, York, Durham, Halton.

## Commands

```sh
npm run dev         # vite dev → http://localhost:5173
npm run build       # static SPA → build/
npm run preview     # serve the production build
npm run check       # svelte-kit sync + svelte-check (type check) — run before considering work done
npm run check:watch # same, in watch mode
```

No test suite. `npm run check` is the only verification gate. There is no lint step.

### Visual self-verify (the map renders nothing in a type check)

Map/data bugs (missing dots, basemap swaps, glyph/font loss) don't show up in `svelte-check`
— drive the running app headlessly with `scripts/shot.mjs` (Playwright + Chromium, a
devDependency):

```sh
npm run dev &                                   # note the printed port (5173/5174/…)
URL=http://localhost:5173/ node scripts/shot.mjs   # screenshots scripts/shot.png + probes the map
```

It loads the page, captures console errors, screenshots (`OUT=` overrides the path), and prints
a probe of the live map (exposed as `window.__map` in dev only — see `CrimeMap.svelte`):
`crimeFeaturesInSource` and rendered cluster/point counts. **Watch for the data-timing trap:**
with no `localStorage` cache the live ArcGIS fetch arrives *after* the basemap loads, so a probe
that's green only on a cached reload is hiding a bug — verify both the fresh (`live`) and
cache-reload paths. Screenshots write to `scripts/*.png` (git-ignored).

Deploy: pushing to `master` triggers `.github/workflows/deploy.yml`, which builds with
`BASE_PATH=/canada-crime-map` and publishes to Pages. `vite.config.ts` reads `BASE_PATH` for the
project-site base and emits a `404.html` SPA fallback; local dev/preview leave it empty.

## Architecture

### Region abstraction is the core extension point

Everything region-specific lives in one `RegionConfig` object (`src/lib/data/regions.ts`).
Query, map, popup, and filter code never hard-code field names — they read through
`fieldMap` (`src/lib/data/types.ts`). Adding a police force = appending one config; no other
code changes for the common case.

`src/lib/data/arcgis.ts` handles **four source shapes**, selected by config flags:

- **Single-layer** (Peel, Toronto, York): one `layerUrl`; `buildWhere` filters by
  `fieldMap.date` (timestamp), category, municipality server-side.
- **Multi-layer** (`subLayers`, Durham): one FeatureServer *per crime type*. `queryMultiLayer`
  queries only the layers for the selected categories and stamps each layer's `category`
  (category is implied by the layer, not a field).
- **Split-date** (`fieldMap.dateParts` + `monthFormat`, Durham): no single timestamp column.
  Server filters coarsely by year; `partsToIso` assembles `year/month/day` (month may be an
  abbreviation like `"Feb"`) into ISO; the exact day range is refined client-side.
  `fetchDataMaxDate` returns null for these (no column to take a max over).
- **Dirty-string** (`clientFilter`, Halton): source pads category/municipality with a leading
  space (`" ROBBERY"`), so exact server-side `IN (...)` matches nothing. Loader fetches by
  date only, then matches category + municipality **client-side** against trimmed values.

Two more per-region normalizations ride along the same config:

- `clearanceMap` maps a source's own status words onto canonical `Solved`/`Ongoing`/`Unsolved`
  (York: `Open→Ongoing`, `Closed→Unsolved`); omit it when the source already uses the canonical
  words (Peel). Unmapped values fall back to `Unsolved`, so a new status word silently becomes
  unsolved rather than erroring.
- `municipalityGroups` is **UI-only** nesting (Halton Hills → Georgetown, Acton): checking a
  parent just selects parent + children in the flat `filters.municipalities`, so query and
  boundary logic are unaffected. Children must also appear in `municipalities`.

`queryLayer` pages every request at `PAGE_SIZE = 2000` (the hosted-layer `maxRecordCount` cap)
with a 200k-row safety valve, requesting `f=geojson&outSR=4326`.

`loadIncidents` is the top-level loader: **cache → live ArcGIS (if `verified`) → demo
fallback**. It always resolves with usable data so the UI never hard-fails; an unverified or
unreachable endpoint silently shows `generateDemo()` data. `verified: false` forces demo.
An `AbortError` is rethrown instead of falling back, so a superseded fetch doesn't flash demo
data onto the map.

### Category string is a join key

A feature's `category` value is the key shared across, and must be kept in sync in **three
places**:
- `CATEGORY_LABELS` + `CATEGORY_COLORS` in `regions.ts` (legend/popup label + color)
- `ICONS` in `src/lib/map/icons.ts` (marker glyph)
- the `match` expressions in `src/lib/map/clusterLayers.ts` (resolve `crime-<category>` image
  and dot color)

All three are **flat global maps, not per-region**, so category codes must stay unique across
regions (Peel's `ASL` vs Toronto's `Assault`) — two regions sharing a string share its label,
color and glyph.

Missing entries fall back to grey dot / default glyph / raw label — they don't error, so a
forgotten mapping shows up only visually. Icons are SVGs rasterized to MapLibre map images
named `crime-<category>` by `loadCrimeIcons()`, called once after style load before the symbol
layer references them.

### Map layers and basemap swapping (`CrimeMap.svelte`)

`setStyle` wipes **all** custom sources, layers and images, so every basemap change re-runs
`addOverlay()`, which rebuilds the whole stack: clustered `crimes` source, an *unclustered*
`crimes-heat` copy (a clustered source only exposes centroids and leaves, which makes a
misleading heatmap), the `boundary` source, then boundary → cluster → icon → solved-badge →
heatmap layers, and re-applies the current heatmap toggle. Invariants to preserve when editing
this file:

- `styleToken` increments per swap; an overlay add carrying a stale token aborts (guards a
  rapid second swap landing while the first is still loading icons).
- Raster styles apply synchronously inside `setStyle` and fire `style.load` before a `once()`
  handler could attach — hence the `spec.kind === 'raster'` branch calling `run()` directly
  instead of waiting for the event.
- Glyphs are forced to `GLYPHS` (`basemaps.ts`) on every style via `transformStyle`, so the
  cluster-count font resolves whatever the basemap ships.
- `ready` is a **plain variable, not `$state`** — making it reactive would re-fire the prop
  effects on every swap and snap the view back.

`src/lib/map/basemaps.ts` is a static catalog of tokenless, CORS-enabled tile services
(OpenFreeMap, Carto, OSM raster); the choice persists in `localStorage` under `ccm:basemap` and
is validated against the catalog on load so a removed style can't strand the map.

### Reactive data flow

`src/routes/+page.svelte` owns all state and drives loads via separate `$effect`s, each with
its own `AbortController` so a superseded fetch is dropped:
- region/filter change → `loadIncidents`
- region change → `fetchDataMaxDate` anchors the date window to the region's latest data (it
  can lag months; Toronto's MCI ~2 months, etc.)
- date/municipality change → `fetchClearanceCounts` (per-category solved/ongoing/unsolved
  tallies from a server-side `groupBy` stats query; deliberately ignores the category filter so
  unchecked rows keep their counts; null for regions without a clearance field) and
  `loadBoundaries` (municipal outline)

Effects snapshot `filters` field by field instead of passing the `$state` proxy, so each field
is tracked as a dependency. Boundary and clearance failures are swallowed — both are decorative.

Switching region clears `filters.categories`/`municipalities` (codes differ per region).
`CrimeMap.svelte` also fires `onAutoRegion` when panning lands the center inside another
region's `bounds` — the current region wins ties, and the flyTo effect skips a region the
user panned into so the view isn't yanked back.

`buildWhere` defaults the category filter to `region.categories` when none are selected, so
unlisted occurrence types (traffic, etc.) don't leak onto the map in the "all" view.

### Boundaries

`src/lib/data/boundaries.ts` resolves municipality codes to display names via `muniLabel`, then
matches the boundary layer's name field with `UPPER(...) IN (...)` on both sides — layers differ
in casing (`Markham` vs `MARKHAM`). `boundary.where` adds an always-applied clause (e.g. dropping
water-extent polygons). Results are memoized per region + selection.

### Cache

`src/lib/data/cache.ts`: two-tier (in-memory + `localStorage`), 30-min TTL, keyed by
region + filter signature (includes categories/municipalities — multi-layer omits those from
the WHERE so the key must carry them). **Bump `PREFIX` (`ccm:cache:vN:`) whenever the cached
`CrimeFeature` shape changes** — old-version entries are pruned on load.

## Adding a region (typical workflow)

1. Find the ArcGIS FeatureServer. Hub portals expose endpoints via the DCAT feed at
   `https://<hub-domain>/api/feed/dcat-us/1.1.json`; the dataset "about" page hides them.
2. Probe `<layerUrl>?f=json` for field names/types, and `.../query?...&returnDistinctValues=true`
   for the exact category/municipality values (watch for padding/casing — distinct queries
   trim for display).
3. Verify the real query shape works (`f=geojson`, date filter, `IN (...)`) before wiring it.
4. Append the `RegionConfig`; add category label/color/icon entries; set the matching flag
   (`subLayers` / `dateParts` / `clientFilter` / `clearanceMap`) if the source isn't a clean
   single layer.
5. Leave `verified: false` until the live query is confirmed — the app then shows demo data
   instead of erroring.

## Windows dev note

The official `typescript-lsp` plugin is broken on Windows under fnm (`.cmd` shim ENOENT); a
local `ts-lsp-win` wrapper plugin is used instead.
