<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
	import type { CrimeCollection, CrimeProps, RegionConfig } from '../data/types';
	import {
		addCrimeLayers,
		addHeatmapLayer,
		addIconLayer,
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

	let {
		region,
		data,
		boundary = EMPTY_BOUNDARY,
		heatmap = false,
		onSelect
	}: {
		region: RegionConfig;
		data: CrimeCollection;
		boundary?: BoundaryCollection;
		heatmap?: boolean;
		onSelect?: (p: CrimeProps) => void;
	} = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let ready = $state(false);

	// Free raster basemap (OpenStreetMap) — no API token required.
	const style: maplibregl.StyleSpecification = {
		version: 8,
		glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
		sources: {
			osm: {
				type: 'raster',
				tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
				tileSize: 256,
				attribution: '© OpenStreetMap contributors'
			}
		},
		layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
	};

	onMount(() => {
		map = new maplibregl.Map({
			container,
			style,
			center: region.center,
			zoom: region.zoom,
			clickTolerance: 6 // forgive finger jitter so taps register as clicks
		});
		map.addControl(new maplibregl.NavigationControl(), 'top-right');
		map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');

		const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });

		map.on('load', async () => {
			map!.addSource(SRC, {
				type: 'geojson',
				data: data as any,
				cluster: true,
				clusterRadius: 50,
				clusterMaxZoom: 14
			});
			// Unclustered copy of the same data, for the heatmap layer.
			map!.addSource(SRC_HEAT, { type: 'geojson', data: data as any });
			// Municipality outline source (under the crime layers).
			map!.addSource(SRC_BOUNDARY, { type: 'geojson', data: boundary as any });
			addBoundaryLayers(map!);
			addCrimeLayers(map!);
			await loadCrimeIcons(map!); // register glyphs before the symbol layer references them
			addIconLayer(map!);
			addHeatmapLayer(map!);
			ready = true;

			// Cluster click -> zoom in to expand it.
			map!.on('click', LYR_CLUSTERS, async (e) => {
				const f = e.features?.[0];
				if (!f) return;
				const clusterId = f.properties?.cluster_id;
				const src = map!.getSource(SRC) as GeoJSONSource;
				const zoom = await src.getClusterExpansionZoom(clusterId);
				map!.easeTo({ center: (f.geometry as any).coordinates, zoom });
			});

			// Single incident click (dot or its glyph) -> popup + notify parent.
			for (const lyr of [LYR_POINT, LYR_ICON]) {
				map!.on('click', lyr, (e) => {
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
				map!.on('mouseenter', lyr, () => (map!.getCanvas().style.cursor = 'pointer'));
				map!.on('mouseleave', lyr, () => (map!.getCanvas().style.cursor = ''));
			}
		});

		return () => map?.remove();
	});

	// Push new data into both sources whenever filters/region change.
	$effect(() => {
		if (!map || !ready) return;
		(map.getSource(SRC) as GeoJSONSource | undefined)?.setData(data as any);
		(map.getSource(SRC_HEAT) as GeoJSONSource | undefined)?.setData(data as any);
	});

	// Update municipality outline when the selection changes.
	$effect(() => {
		if (!map || !ready) return;
		(map.getSource(SRC_BOUNDARY) as GeoJSONSource | undefined)?.setData(boundary as any);
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
