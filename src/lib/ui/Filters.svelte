<script lang="ts">
	import type { Filters, RegionConfig } from '../data/types';
	import { colorFor, labelFor, muniLabel } from '../data/regions';

	let {
		region,
		filters = $bindable(),
		count,
		source
	}: {
		region: RegionConfig;
		filters: Filters;
		count: number;
		source: 'live' | 'cache' | 'demo';
	} = $props();

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}
</script>

<div class="panel">
	<h1>Canada Crime Map</h1>
	<p class="sub">{region.label}</p>

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
				<span class="dot" style:background={colorFor(cat)}></span>
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

	<div class="status">
		<strong>{count.toLocaleString()}</strong> incidents
		<span class="badge" class:demo={source === 'demo'}>{source}</span>
	</div>
	{#if source === 'demo'}
		<p class="note">
			Showing demo data — the live Peel endpoint isn't wired in yet. See
			<code>regions.ts</code>.
		</p>
	{/if}
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
		padding: 14px 16px;
		background: rgba(255, 255, 255, 0.96);
		border-radius: 10px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
		font: 13px/1.4 system-ui, sans-serif;
		color: #1a1a1a;
	}
	h1 {
		margin: 0;
		font-size: 17px;
	}
	.sub {
		margin: 2px 0 12px;
		color: #555;
		font-size: 12px;
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
		gap: 6px;
		padding: 2px 0;
		cursor: pointer;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: inline-block;
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
	code {
		background: #f2f2f2;
		padding: 0 3px;
		border-radius: 3px;
	}
</style>
