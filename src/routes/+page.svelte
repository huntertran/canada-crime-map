<script lang="ts">
	import CrimeMap from '$lib/map/CrimeMap.svelte';
	import Filters from '$lib/ui/Filters.svelte';
	import DetailPanel from '$lib/ui/DetailPanel.svelte';
	import BasemapPicker from '$lib/ui/BasemapPicker.svelte';
	import { loadBasemapPref, saveBasemapPref, type BasemapPref } from '$lib/map/basemaps';
	import { REGIONS, DEFAULT_REGION } from '$lib/data/regions';
	import { loadIncidents, fetchDataMaxDate, fetchClearanceCounts } from '$lib/data/arcgis';
	import { loadBoundaries, EMPTY_BOUNDARY, type BoundaryCollection } from '$lib/data/boundaries';
	import type {
		ClearanceCounts,
		CrimeCollection,
		CrimeProps,
		RegionConfig,
		Filters as FilterState
	} from '$lib/data/types';

	let region = $state<RegionConfig>(DEFAULT_REGION);
	let basemap = $state<BasemapPref>(loadBasemapPref());
	$effect(() => saveBasemapPref(basemap));

	function isoDaysAgo(days: number): string {
		return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
	}

	function isoDaysBefore(isoDate: string, days: number): string {
		return new Date(new Date(isoDate).getTime() - days * 86400000).toISOString().slice(0, 10);
	}

	let filters = $state<FilterState>({
		from: isoDaysAgo(90),
		to: isoDaysAgo(0),
		categories: [],
		municipalities: []
	});

	// Switch region: category/municipality codes differ per region, so clear them.
	function selectRegion(r: RegionConfig) {
		if (r.id === region.id) return;
		region = r;
		filters.categories = [];
		filters.municipalities = [];
		selected = null;
	}

	let data = $state<CrimeCollection>({ type: 'FeatureCollection', features: [] });
	let source = $state<'live' | 'cache' | 'demo'>('demo');
	let loading = $state(false);
	let selected = $state<CrimeProps | null>(null);
	let showHeatmap = $state(false);
	let boundary = $state<BoundaryCollection>(EMPTY_BOUNDARY);
	let dataThrough = $state<string | null>(null);
	let clearanceCounts = $state<ClearanceCounts | null>(null);

	// Anchor the window to the region's latest available data (data can lag months).
	$effect(() => {
		const reg = region;
		const ctrl = new AbortController();
		fetchDataMaxDate(reg, ctrl.signal)
			.then((mx) => {
				dataThrough = mx;
				if (mx) {
					filters.to = mx;
					filters.from = isoDaysBefore(mx, 90);
				}
			})
			.catch(() => {});
		return () => ctrl.abort();
	});

	// Reload whenever region or filters change. Snapshot so the effect tracks each field.
	$effect(() => {
		const reg = region;
		const snapshot: FilterState = {
			from: filters.from,
			to: filters.to,
			categories: [...filters.categories],
			municipalities: [...filters.municipalities]
		};
		const ctrl = new AbortController();
		loading = true;
		loadIncidents(reg, snapshot, ctrl.signal)
			.then((res) => {
				if (ctrl.signal.aborted) return; // a newer load superseded this one
				data = res.data;
				source = res.source;
			})
			.catch(() => {}) // aborted fetch — ignore
			.finally(() => {
				if (!ctrl.signal.aborted) loading = false;
			});
		return () => ctrl.abort();
	});

	// Per-category solved/unsolved tallies for the filter list. Tracks date/municipality
	// but not the category checkboxes (fetchClearanceCounts ignores those on purpose).
	$effect(() => {
		const reg = region;
		const snapshot: FilterState = {
			from: filters.from,
			to: filters.to,
			categories: [],
			municipalities: [...filters.municipalities]
		};
		const ctrl = new AbortController();
		fetchClearanceCounts(reg, snapshot, ctrl.signal)
			.then((c) => (clearanceCounts = c))
			.catch(() => {}); // counts are decorative — ignore failures
		return () => ctrl.abort();
	});

	// Outline the selected municipalities. Separate effect: only refetch on that change.
	$effect(() => {
		const munis = [...filters.municipalities];
		const ctrl = new AbortController();
		loadBoundaries(region, munis, ctrl.signal)
			.then((fc) => (boundary = fc))
			.catch(() => {}); // boundary is decorative — ignore failures
		return () => ctrl.abort();
	});
</script>

<svelte:head>
	<title>Canada Crime Map — {region.label}</title>
</svelte:head>

<main>
	<CrimeMap
		{region}
		regions={REGIONS}
		{data}
		{boundary}
		heatmap={showHeatmap}
		{basemap}
		onSelect={(p) => (selected = p)}
		onAutoRegion={selectRegion}
	/>
	<Filters
		{region}
		regions={REGIONS}
		onRegion={selectRegion}
		bind:filters
		bind:showHeatmap
		count={data.features.length}
		{source}
		{dataThrough}
		{clearanceCounts}
	/>
	<DetailPanel incident={selected} onClose={() => (selected = null)} />
	<BasemapPicker bind:basemap />
	{#if loading}<div class="loading">Loading…</div>{/if}
</main>

<style>
	main {
		position: fixed;
		inset: 0;
		overflow: hidden;
	}
	.loading {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 6;
		background: rgba(0, 0, 0, 0.78);
		color: #fff;
		padding: 6px 16px;
		border-radius: 16px;
		font: 13px system-ui, sans-serif;
	}
</style>
