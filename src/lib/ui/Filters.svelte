<script lang="ts">
	import { onMount } from 'svelte';
	import type { Filters, RegionConfig } from '../data/types';
	import { colorFor, labelFor, muniLabel } from '../data/regions';
	import { iconSvg } from '../map/icons';

	let {
		region,
		regions,
		onRegion,
		filters = $bindable(),
		showHeatmap = $bindable(false),
		count,
		source,
		dataThrough = null
	}: {
		region: RegionConfig;
		regions: RegionConfig[];
		onRegion: (r: RegionConfig) => void;
		filters: Filters;
		showHeatmap?: boolean;
		count: number;
		source: 'live' | 'cache' | 'demo';
		dataThrough?: string | null;
	} = $props();

	function prettyDate(iso: string): string {
		const d = new Date(iso);
		return isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function onRegionChange(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		const r = regions.find((x) => x.id === id);
		if (r) onRegion(r);
	}

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	// Collapse the panel by default on small/touch screens so it doesn't bury the map.
	let open = $state(true);
	onMount(() => {
		if (window.matchMedia('(max-width: 640px)').matches) open = false;
	});
</script>

<div class="panel" class:open>
	<button class="header" onclick={() => (open = !open)} aria-expanded={open}>
		<span class="titles">
			<span class="title">Canada Crime Map</span>
			<span class="sub">{region.label}</span>
		</span>
		<span class="chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
	</button>

	<div class="body">
	<label class="field region">
		<span>Region</span>
		<select value={region.id} onchange={onRegionChange}>
			{#each regions as r}
				<option value={r.id}>{r.label}</option>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>From</span>
		<input type="date" bind:value={filters.from} max={filters.to} />
	</label>
	<label class="field">
		<span>To</span>
		<input type="date" bind:value={filters.to} min={filters.from} />
	</label>

	<fieldset>
		<legend>Crime type</legend>
		{#each region.categories as cat}
			<label class="chk">
				<input
					type="checkbox"
					checked={filters.categories.includes(cat)}
					onchange={() => (filters.categories = toggle(filters.categories, cat))}
				/>
				<span class="chip" style:background={colorFor(cat)}>{@html iconSvg(cat)}</span>
				{labelFor(cat)}
			</label>
		{/each}
	</fieldset>

	{#if region.municipalities.length}
		<fieldset>
			<legend>Municipality</legend>
			{#each region.municipalities as m}
				<label class="chk">
					<input
						type="checkbox"
						checked={filters.municipalities.includes(m)}
						onchange={() => (filters.municipalities = toggle(filters.municipalities, m))}
					/>
					{muniLabel(m)}
				</label>
			{/each}
		</fieldset>
	{/if}

	<fieldset>
		<legend>View</legend>
		<label class="chk">
			<input type="checkbox" bind:checked={showHeatmap} />
			Heatmap
		</label>
	</fieldset>

	<div class="status">
		<strong>{count.toLocaleString()}</strong> incidents
		<span class="badge" class:demo={source === 'demo'}>{source}</span>
	</div>
	{#if dataThrough}
		<p class="through">Data through {prettyDate(dataThrough)}</p>
	{/if}
	{#if source === 'demo'}
		<p class="note">
			Showing demo data — the live Peel endpoint isn't wired in yet. See
			<code>regions.ts</code>.
		</p>
	{/if}
	</div>
</div>

<style>
	.panel {
		position: absolute;
		top: 12px;
		left: 12px;
		z-index: 5;
		width: 250px;
		max-height: calc(100% - 24px);
		overflow: auto;
		padding: 6px 16px 14px;
		background: rgba(255, 255, 255, 0.96);
		border-radius: 10px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
		font: 13px/1.4 system-ui, sans-serif;
		color: #1a1a1a;
		-webkit-overflow-scrolling: touch;
	}
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: calc(100% + 32px);
		margin: 0 -16px;
		padding: 10px 16px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font: inherit;
	}
	.titles {
		display: flex;
		flex-direction: column;
	}
	.title {
		font-size: 17px;
		font-weight: 700;
	}
	.sub {
		color: #555;
		font-size: 12px;
	}
	.chevron {
		color: #888;
		font-size: 14px;
	}
	/* Collapsed: hide everything but the header. */
	.panel:not(.open) .body {
		display: none;
	}
	.body {
		padding-top: 8px;
	}
	.field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.field input {
		flex: 0 0 auto;
	}
	fieldset {
		border: none;
		border-top: 1px solid #e2e2e2;
		margin: 10px 0 0;
		padding: 8px 0 0;
	}
	legend {
		font-weight: 600;
		padding: 0;
		margin-bottom: 4px;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
		padding: 4px 0;
		cursor: pointer;
	}
	.chk input[type='checkbox'] {
		width: 18px;
		height: 18px;
		flex: 0 0 auto;
	}
	.field input[type='date'] {
		width: 150px;
		min-height: 32px;
		padding: 4px 6px;
		box-sizing: border-box;
	}
	.region select {
		width: 150px;
		min-height: 32px;
		padding: 4px 6px;
		box-sizing: border-box;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		flex: 0 0 auto;
	}
	.chip :global(svg) {
		width: 14px;
		height: 14px;
	}
	.status {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid #e2e2e2;
	}
	.badge {
		float: right;
		font-size: 11px;
		text-transform: uppercase;
		background: #2e7d32;
		color: #fff;
		padding: 1px 7px;
		border-radius: 8px;
	}
	.badge.demo {
		background: #b26a00;
	}
	.note {
		margin: 8px 0 0;
		font-size: 11px;
		color: #8a5a00;
	}
	.through {
		margin: 6px 0 0;
		font-size: 11px;
		color: #666;
	}
	code {
		background: #f2f2f2;
		padding: 0 3px;
		border-radius: 3px;
	}

	/* Touch / small screens: dock as a bottom sheet, full width, bigger targets. */
	@media (max-width: 640px) {
		.panel {
			top: auto;
			left: 8px;
			right: 8px;
			bottom: 8px;
			width: auto;
			max-height: 65vh;
			border-radius: 14px;
		}
		.header {
			padding: 14px 16px;
		}
		.chk {
			min-height: 44px;
		}
		.field input[type='date'] {
			min-height: 40px;
			font-size: 16px; /* prevents iOS zoom-on-focus */
		}
	}
</style>
