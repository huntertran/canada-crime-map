<script lang="ts">
	import CrimeMap from '$lib/map/CrimeMap.svelte';
	import Filters from '$lib/ui/Filters.svelte';
	import DetailPanel from '$lib/ui/DetailPanel.svelte';
	import { DEFAULT_REGION } from '$lib/data/regions';
	import { loadIncidents } from '$lib/data/arcgis';
	import { loadBoundaries, EMPTY_BOUNDARY, type BoundaryCollection } from '$lib/data/boundaries';
	import type { CrimeCollection, CrimeProps, Filters as FilterState } from '$lib/data/types';

	const region = DEFAULT_REGION;

	function isoDaysAgo(days: number): string {
		return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
	}

	let filters = $state<FilterState>({
		from: isoDaysAgo(90),
		to: isoDaysAgo(0),
		categories: [],
		municipalities: []
	});

	let data = $state<CrimeCollection>({ type: 'FeatureCollection', features: [] });
	let source = $state<'live' | 'cache' | 'demo'>('demo');
	let loading = $state(false);
	let selected = $state<CrimeProps | null>(null);
	let showHeatmap = $state(false);
	let boundary = $state<BoundaryCollection>(EMPTY_BOUNDARY);

	// Reload whenever filters change. Snapshot so the effect tracks each field.
	$effect(() => {
		const snapshot: FilterState = {
			from: filters.from,
			to: filters.to,
			categories: [...filters.categories],
			municipalities: [...filters.municipalities]
		};
		const ctrl = new AbortController();
		loading = true;
		loadIncidents(region, snapshot, ctrl.signal)
			.then((res) => {
				data = res.data;
				source = res.source;
			})
			.finally(() => (loading = false));
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
	<CrimeMap {region} {data} {boundary} heatmap={showHeatmap} onSelect={(p) => (selected = p)} />
	<Filters {region} bind:filters bind:showHeatmap count={data.features.length} {source} />
	<DetailPanel incident={selected} onClose={() => (selected = null)} />
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
