# Canada Crime Map — Implementation Plan

## Context

Greenfield project. Goal: a
web map showing crime incidents, starting with **Peel Region** police data, designed so
other regions plug in later. Core UX:

1. Crimes shown as icons on a map.
2. Zoom out → icons collapse into numbered clusters; further out → bigger aggregates
   ("more dots combined"). Classic supercluster behavior.
3. Click a zoomed-in single icon (a non-cluster leaf) → show incident details.
4. Suggest more features.

**Decided stack (from user):** SvelteKit + TypeScript · MapLibre GL JS (native GeoJSON
clustering = supercluster, free, no token) · **live-query** Peel's ArcGIS REST API from
the browser (no backend) · deploy as a **static site** (adapter-static, SPA mode) to
Netlify/Pages/Vercel.

## Data source — Peel ArcGIS REST

Peel Regional Police publishes the **Crime Occurrence** layer (36 months, major crime
categories) on an ArcGIS Hub Community Safety Data Portal. ArcGIS Online
(`services*.arcgis.com`) is **CORS-enabled** and serves GeoJSON directly — perfect for a
no-backend live query.

> ⚠️ The exact FeatureServer URL is rendered client-side on the Hub and not in static
> HTML, so it must be captured, not guessed. (A candidate found during research,
> `…/hRUr1F8lE8Jq2uJo/…/Crime_Incidents_Pulsing/…`, is actually a **Washington DC** demo
> dataset — do **not** use it.)

**First implementation step — capture the real endpoint:**
- Open the Crime Occurrence Map at the Hub portal (peel-regional-police-community-safety-
  data-portal-peelpolice.hub.arcgis.com) or the Experience app
  `experience.arcgis.com/experience/6eb9c3c452c34ce2b19821de0f6eb775`.
- In browser DevTools → Network, filter `query?` — grab the
  `…/FeatureServer/<n>/query` URL. Confirm it serves Peel (fields for offence type, date,
  municipality Brampton/Mississauga, lat/lon).
- Hit `…/FeatureServer/<n>?f=json` to record: field names, `maxRecordCount` (typically
  2000), `supportsPagination`, geometry type, and any coded-value domains for the crime
  category field. These exact field names feed the query + popup mapping.

**Query pattern** (GeoJSON, paginated):
```
GET <layer>/query
  ?where=<filter SQL, e.g. ReportDate >= DATE '2026-03-01'>
  &outFields=<id,category,date,location,municipality>
  &geometryType=esriGeometryEnvelope&inSR=4326   (optional bbox)
  &outSR=4326
  &resultOffset=<n>&resultRecordCount=2000
  &f=geojson
```
Loop `resultOffset` by `maxRecordCount` until a page returns fewer than the page size.

## Architecture

No backend. Browser → ArcGIS directly. SvelteKit used as a thin SPA shell + component
model; `adapter-static` with a SPA fallback so it ships as plain files.

```
src/
  lib/
    data/
      arcgis.ts        # query builder + paginated fetch → GeoJSON FeatureCollection
      regions.ts       # region registry: { id, label, layerUrl, fieldMap, center }
      types.ts         # CrimeIncident, RegionConfig, FieldMap
      cache.ts         # in-memory + localStorage cache keyed by region+filters
    map/
      CrimeMap.svelte  # MapLibre init, clustered source + 3 layers, click handlers
      clusterLayers.ts # paint/layout specs for clusters, count labels, leaf icons
      popup.ts         # build incident detail popup HTML from fieldMap
    ui/
      Filters.svelte   # date range + category + municipality controls
      DetailPanel.svelte # incident detail (popup or side panel)
      Legend.svelte
  routes/
    +layout.ts         # export const ssr=false, prerender=false (SPA)
    +page.svelte       # compose map + filters + legend
```

### Region abstraction (req: "other regions later")
`regions.ts` holds an array of `RegionConfig`:
```ts
type FieldMap = { id; category; date; municipality?; description?; lat?; lon? };
type RegionConfig = {
  id: 'peel'; label: 'Peel Region';
  layerUrl: string; fieldMap: FieldMap;
  center: [lng, lat]; zoom: number;
  dateField: string; categories?: string[];
};
```
Adding Toronto/York later = append one `RegionConfig`. All data/query/popup code reads
through `fieldMap`, never hard-coded field names.

### Map + clustering (req 1 & 2)
MapLibre GeoJSON source with `cluster: true`:
```ts
map.addSource('crimes', { type:'geojson', data: fc,
  cluster:true, clusterRadius:50, clusterMaxZoom:14 });
```
Three layers (the supercluster pattern):
- `clusters` — circles, sized/colored by `point_count` via step expressions ("more dots
  combined" the further out).
- `cluster-count` — symbol layer, `text-field: {point_count_abbreviated}` (the numbers).
- `unclustered-point` — the single crime **icon** (custom sprite per category, or a
  colored circle fallback). This is the "zoomed-in icon".
Click on `clusters` → `getClusterExpansionZoom` → `easeTo` (zoom the cluster open).

Base map: free MapLibre demo/OpenStreetMap raster style or a free vector style (no token).

### Details on click (req 3)
Click handler on `unclustered-point` → read `feature.properties` → render via
`fieldMap` into a MapLibre `Popup` (or `DetailPanel.svelte` side panel for richer layout):
offence type, date/time, location/municipality, plus a "report inaccuracy" note that this
is approximate (Peel geocodes to nearest intersection).

### Filters (req 4 groundwork)
`Filters.svelte`: date range (default last 3 months to keep point count browser-friendly —
36 months of major crimes is large for one client-side load), crime category multiselect
(from layer domain), municipality (Brampton/Mississauga). Changing a filter rebuilds the
`where` clause, refetches (cache-aware), and calls `source.setData(...)`.

### Caching
`cache.ts`: memoize fetched FeatureCollections by `region|where|fields` in memory and
localStorage (with a short TTL) so re-toggling filters doesn't re-hit ArcGIS.

## Roadmap

Built:
- [x] Date + category + municipality filters
- [x] Legend
- [x] Incident detail panel
- [x] "Locate me" geolocate control

Backlog:
- [ ] Shareable URL state (filters/viewport in query params)
- [ ] Heatmap toggle
- [ ] Time-slider animation over the full window
- [ ] Per-area crime-rate choropleth
- [ ] Trend sparkline
- [ ] Multi-region switcher UI
- [ ] CSV export of current view
- [ ] Dark mode

## Verification
1. `npm run dev` → map loads centered on Peel; demo base tiles render.
2. With endpoint wired: incidents appear; zooming **out** collapses icons into numbered
   clusters, zooming **in** splits them back to single icons — confirms req 1 & 2.
3. Click a cluster → map zooms to expand it. Click a single icon → detail
   popup/panel shows correct offence/date/location for that feature — confirms req 3.
4. Change date/category/municipality filter → point set updates; second identical filter
   is served from cache (check Network has no duplicate ArcGIS call).
5. Network tab: ArcGIS `query?f=geojson` calls succeed cross-origin (CORS ok) and
   paginate via `resultOffset` until exhausted.
6. `npm run build && npm run preview` → static SPA build serves and behaves identically.

## Key files to create
- `src/lib/data/arcgis.ts`, `regions.ts`, `types.ts`, `cache.ts`
- `src/lib/map/CrimeMap.svelte`, `clusterLayers.ts`, `popup.ts`
- `src/lib/ui/Filters.svelte`, `DetailPanel.svelte`, `Legend.svelte`
- `src/routes/+layout.ts` (SPA flags), `src/routes/+page.svelte`
- `svelte.config.js` (adapter-static + SPA fallback), `package.json` deps:
  `maplibre-gl`, `@sveltejs/adapter-static`
