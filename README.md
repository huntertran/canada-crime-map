# Canada Crime Map

Interactive web map of crime incidents, starting with **Peel Region** (Brampton /
Mississauga / Caledon). Incidents are queried **live** from Peel Regional Police's public
ArcGIS data and rendered as a clustered map — no backend, no API key. The region layer is
pluggable so other police services can be added later.

🔗 **Live:** https://huntertran.github.io/canada-crime-map/

## Features

- **Live data** — queries Peel's ArcGIS REST FeatureServer directly from the browser
  (CORS-enabled), paginated, no server in between. Falls back to a small demo dataset if
  the source is unreachable.
- **Map clustering** — MapLibre GL native clustering: zoom out collapses incidents into
  numbered clusters that grow with count; zoom in splits them back into single icons.
  Click a cluster to zoom it open.
- **Incident details** — click a single incident for offence type, date, municipality, and
  street.
- **Filters** — date range (default last 90 days), crime category, and municipality.
  Changing a filter rebuilds the query and refetches.
- **Category colors + legend** — each offence type has a consistent color across map,
  legend, and detail panel.
- **Client-side cache** — fetched results are memoized (memory + `localStorage`) so
  re-toggling filters doesn't re-hit ArcGIS.
- **Pluggable regions** — add a new force by appending one `RegionConfig`
  (`src/lib/data/regions.ts`); all query/popup code reads through a `fieldMap`, never
  hard-coded field names.

## Data source

Peel Regional Police **Crime Occurrence** layer (rolling ~36 months, major crime
categories), served as GeoJSON from ArcGIS Online. Locations are approximate — Peel
geocodes incidents to the nearest intersection.

## Tech stack

SvelteKit + TypeScript · MapLibre GL JS (free, no token) · `adapter-static` (SPA) ·
deployed to GitHub Pages.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
```

```sh
npm run build      # static SPA → build/
npm run preview    # serve the production build
npm run check      # type + svelte check
```

## Deploy

Pushing to `master` runs `.github/workflows/deploy.yml`, which builds with
`BASE_PATH=/canada-crime-map` and publishes to GitHub Pages. One-time setup: repo
**Settings → Pages → Source: GitHub Actions**.

## Roadmap

- [ ] Heatmap toggle
- [ ] Time-slider animation over the full window
- [ ] Per-area crime-rate choropleth
- [ ] Trend sparkline
- [ ] Multi-region switcher UI
- [ ] CSV export of current view
- [ ] Shareable URL state
- [ ] Dark mode
