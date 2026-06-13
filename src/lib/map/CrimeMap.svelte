<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
	import type { CrimeCollection, CrimeProps, RegionConfig } from '../data/types';
	import {
		addCrimeLayers,
		addHeatmapLayer,
		addIconLayer,
		addSolvedBadgeLayer,
		addBoundaryLayers,
		SRC,
		SRC_HEAT,
		SRC_BOUNDARY,
		LYR_HEAT,
		LYR_CLUSTERS,
		LYR_POINT,
		LYR_ICON,
		CLUSTER_LAYERS
	} from './clusterLayers';
	import { loadCrimeIcons } from './icons';
	import { buildPopupHtml } from './popup';
	import { EMPTY_BOUNDARY, type BoundaryCollection } from '../data/boundaries';
	import { GLYPHS, resolveSpec, type BasemapPref, type BasemapSpec } from './basemaps';

	let {
		region,
		regions = [],
		data,
		boundary = EMPTY_BOUNDARY,
		heatmap = false,
		basemap,
		onSelect,
		onAutoRegion
	}: {
		region: RegionConfig;
		regions?: RegionConfig[];
		data: CrimeCollection;
		boundary?: BoundaryCollection;
		heatmap?: boolean;
		basemap: BasemapPref;
		onSelect?: (p: CrimeProps) => void;
		/** Fired when panning lands the map inside another region's bounds. */
		onAutoRegion?: (r: RegionConfig) => void;
	} = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	// Plain guard (not $state): used to gate the prop effects below. Kept non-reactive so a
	// basemap swap toggling it doesn't re-fire those effects (which would snap the view back).
	let ready = false;
	// Region id selected by panning — the flyTo effect skips it so the map isn't yanked
	// back to the region's home view right after the user scrolled there themselves.
	let pannedToRegionId: string | null = null;

	function inBounds([lng, lat]: [number, number], [w, s, e, n]: [number, number, number, number]) {
		return lng >= w && lng <= e && lat >= s && lat <= n;
	}

	// If the map center left the active region and entered another region's bounds,
	// switch the app to that region. Current region wins ties in overlap zones.
	function detectRegion() {
		if (!map || !onAutoRegion || map.getZoom() < 8) return;
		const c = map.getCenter();
		const center: [number, number] = [c.lng, c.lat];
		if (region.bounds && inBounds(center, region.bounds)) return;
		const hit = regions.find((r) => r.id !== region.id && r.bounds && inBounds(center, r.bounds));
		if (hit) {
			pannedToRegionId = hit.id;
			onAutoRegion(hit);
		}
	}

	// Translate a basemap spec into a MapLibre style. Vector styles are loaded by URL;
	// raster styles get an inline spec. `glyphs` is forced on raster (and overridden on
	// vector via transformStyle) so the cluster-count font always resolves.
	function toMapStyle(spec: BasemapSpec): string | maplibregl.StyleSpecification {
		if (spec.kind === 'url') return spec.url;
		return {
			version: 8,
			glyphs: GLYPHS,
			sources: {
				osm: { type: 'raster', tiles: spec.tiles, tileSize: 256, attribution: spec.attribution }
			},
			layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
		};
	}

	// Each setStyle bumps this; an overlay add tagged with a stale token aborts. Guards
	// against a rapid second swap landing while the first is still loading icons.
	let styleToken = 0;
	let started = false; // becomes true once the map's first load fires (initial apply done there)

	// (Re-)add the crime overlay on top of the current basemap. Called after every style
	// load, since setStyle wipes custom sources/layers/images. Reads current props directly.
	async function addOverlay(token: number): Promise<void> {
		if (!map) return;
		map.addSource(SRC, {
			type: 'geojson',
			data: data as any,
			cluster: true,
			clusterRadius: 50,
			clusterMaxZoom: 14
		});
		// Unclustered copy of the same data, for the heatmap layer.
		map.addSource(SRC_HEAT, { type: 'geojson', data: data as any });
		// Municipality outline source (under the crime layers).
		map.addSource(SRC_BOUNDARY, { type: 'geojson', data: boundary as any });
		addBoundaryLayers(map);
		addCrimeLayers(map);
		await loadCrimeIcons(map); // register glyphs before the symbol layer references them
		if (token !== styleToken || !map) return; // a newer swap superseded this one
		addIconLayer(map);
		addSolvedBadgeLayer(map);
		addHeatmapLayer(map);
		// Apply the current heatmap toggle immediately (effect won't re-fire on swap).
		map.setLayoutProperty(LYR_HEAT, 'visibility', heatmap ? 'visible' : 'none');
		for (const lyr of CLUSTER_LAYERS) {
			map.setLayoutProperty(lyr, 'visibility', heatmap ? 'none' : 'visible');
		}
		ready = true;
	}

	// Swap the basemap: setStyle (forcing our glyphs), then re-add the overlay on load.
	function applyBasemap(spec: BasemapSpec): void {
		if (!map) return;
		ready = false;
		const token = ++styleToken;
		map.setStyle(toMapStyle(spec), {
			transformStyle: (_prev, next) => ({ ...next, glyphs: GLYPHS })
		});
		const run = () => {
			if (token === styleToken) addOverlay(token);
		};
		// Inline (raster) styles apply synchronously inside setStyle and fire 'style.load'
		// before a once() handler could attach; URL (vector) styles load asynchronously.
		if (spec.kind === 'raster') run();
		else map.once('style.load', run);
	}

	onMount(() => {
		// Start with an empty style; applyBasemap (from the first 'load') sets the real one.
		map = new maplibregl.Map({
			container,
			style: { version: 8, glyphs: GLYPHS, sources: {}, layers: [] },
			center: region.center,
			zoom: region.zoom,
			clickTolerance: 6 // forgive finger jitter so taps register as clicks
		});
		map.addControl(new maplibregl.NavigationControl(), 'top-right');
		map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');

		const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });

		// Layer-scoped handlers are bound once: they persist across setStyle and re-bind to
		// the re-added layers by id, so they don't need re-registering on a basemap swap.
		map.on('click', LYR_CLUSTERS, async (e) => {
			const f = e.features?.[0];
			if (!f) return;
			const clusterId = f.properties?.cluster_id;
			const src = map!.getSource(SRC) as GeoJSONSource;
			const zoom = await src.getClusterExpansionZoom(clusterId);
			map!.easeTo({ center: (f.geometry as any).coordinates, zoom });
		});

		// Single incident click (dot or its glyph) -> popup + notify parent.
		for (const lyr of [LYR_POINT, LYR_ICON]) {
			map.on('click', lyr, (e) => {
				const f = e.features?.[0];
				if (!f) return;
				const props = f.properties as unknown as CrimeProps;
				popup
					.setLngLat((f.geometry as any).coordinates)
					.setHTML(buildPopupHtml(props))
					.addTo(map!);
				onSelect?.(props);
			});
		}

		for (const lyr of [LYR_CLUSTERS, LYR_POINT, LYR_ICON]) {
			map.on('mouseenter', lyr, () => (map!.getCanvas().style.cursor = 'pointer'));
			map.on('mouseleave', lyr, () => (map!.getCanvas().style.cursor = ''));
		}

		map.on('moveend', detectRegion);
		if (import.meta.env.DEV) (window as any).__map = map; // debug handle

		// Wait for the empty style to finish before the first real setStyle, so applyBasemap's
		// once('style.load') can't be consumed by the initial style's load (which would add the
		// overlay only to have the basemap swap wipe it). Subsequent swaps go through the effect.
		map.on('load', () => {
			started = true;
			applyBasemap(resolveSpec(basemap.service, basemap.style));
		});

		return () => map?.remove();
	});

	// Apply on every basemap-selection change. The initial apply is handled by 'load' above.
	$effect(() => {
		const { service, style } = basemap;
		if (!map || !started) return;
		applyBasemap(resolveSpec(service, style));
	});

	// Push new data into both sources whenever filters/region change.
	// Read `data` up front so it's tracked as a dependency even when the guard returns early
	// (ready is a plain, untracked flag — without this the effect wouldn't re-run on new data).
	$effect(() => {
		const d = data;
		if (!map || !ready) return;
		(map.getSource(SRC) as GeoJSONSource | undefined)?.setData(d as any);
		(map.getSource(SRC_HEAT) as GeoJSONSource | undefined)?.setData(d as any);
	});

	// Update municipality outline when the selection changes (read up front — see above).
	$effect(() => {
		const b = boundary;
		if (!map || !ready) return;
		(map.getSource(SRC_BOUNDARY) as GeoJSONSource | undefined)?.setData(b as any);
	});

	// Fly to the active region's extent when it changes — unless the change came from
	// the user panning into the region, in which case stay where they are.
	$effect(() => {
		const { id, center, zoom } = region;
		if (!map || !ready) return;
		if (pannedToRegionId === id) {
			pannedToRegionId = null;
			return;
		}
		map.flyTo({ center, zoom, essential: true });
	});

	// Toggle between cluster view and heatmap view.
	$effect(() => {
		if (!map || !ready) return;
		map.setLayoutProperty(LYR_HEAT, 'visibility', heatmap ? 'visible' : 'none');
		for (const lyr of CLUSTER_LAYERS) {
			map.setLayoutProperty(lyr, 'visibility', heatmap ? 'none' : 'visible');
		}
	});
</script>

<div class="map" bind:this={container}></div>

<style>
	.map {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
</style>
