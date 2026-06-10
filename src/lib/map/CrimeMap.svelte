<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
	import type { CrimeCollection, CrimeProps, RegionConfig } from '../data/types';
	import { addCrimeLayers, SRC, LYR_CLUSTERS, LYR_POINT } from './clusterLayers';
	import { buildPopupHtml } from './popup';

	let {
		region,
		data,
		onSelect
	}: {
		region: RegionConfig;
		data: CrimeCollection;
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
			zoom: region.zoom
		});
		map.addControl(new maplibregl.NavigationControl(), 'top-right');
		map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');

		const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });

		map.on('load', () => {
			map!.addSource(SRC, {
				type: 'geojson',
				data: data as any,
				cluster: true,
				clusterRadius: 50,
				clusterMaxZoom: 14
			});
			addCrimeLayers(map!);
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

			// Single incident click -> popup + notify parent (detail panel).
			map!.on('click', LYR_POINT, (e) => {
				const f = e.features?.[0];
				if (!f) return;
				const props = f.properties as unknown as CrimeProps;
				popup
					.setLngLat((f.geometry as any).coordinates)
					.setHTML(buildPopupHtml(props))
					.addTo(map!);
				onSelect?.(props);
			});

			for (const lyr of [LYR_CLUSTERS, LYR_POINT]) {
				map!.on('mouseenter', lyr, () => (map!.getCanvas().style.cursor = 'pointer'));
				map!.on('mouseleave', lyr, () => (map!.getCanvas().style.cursor = ''));
			}
		});

		return () => map?.remove();
	});

	// Push new data into the source whenever filters/region change.
	$effect(() => {
		if (!map || !ready) return;
		const src = map.getSource(SRC) as GeoJSONSource | undefined;
		src?.setData(data as any);
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
