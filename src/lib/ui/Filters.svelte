<script lang="ts">
	import { onMount } from 'svelte';
	import type { ClearanceCounts, Filters, RegionConfig } from '../data/types';
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
		dataThrough = null,
		clearanceCounts = null
	}: {
		region: RegionConfig;
		regions: RegionConfig[];
		onRegion: (r: RegionConfig) => void;
		filters: Filters;
		showHeatmap?: boolean;
		count: number;
		source: 'live' | 'cache' | 'demo';
		dataThrough?: string | null;
		clearanceCounts?: ClearanceCounts | null;
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

	// Municipality nesting (e.g. Halton Hills → Georgetown, Acton). Children render indented
	// under the parent; the tree is a display concern — checking a parent just selects the
	// parent + child codes in the flat filters.municipalities, so matching is unchanged.
	type MuniGroup = { code: string; children: string[] };
	const muniGroups = $derived(region.municipalityGroups ?? []);
	const childCodes = $derived(new Set(muniGroups.flatMap((g) => g.children)));
	const topMunis = $derived(region.municipalities.filter((m) => !childCodes.has(m)));
	let collapsed = $state<Record<string, boolean>>({}); // default: groups expanded

	const groupFor = (code: string): MuniGroup | undefined => muniGroups.find((g) => g.code === code);
	const members = (g: MuniGroup): string[] => [g.code, ...g.children];

	function toggleParent(g: MuniGroup) {
		const mem = members(g);
		const all = mem.every((c) => filters.municipalities.includes(c));
		filters.municipalities = all
			? filters.municipalities.filter((c) => !mem.includes(c))
			: [...new Set([...filters.municipalities, ...mem])];
	}

	// Tri-state parent checkbox: the indeterminate flag can't be set via markup attributes.
	function indeterminate(node: HTMLInputElement, value: boolean) {
		node.indeterminate = value;
		return { update: (v: boolean) => (node.indeterminate = v) };
	}

	// Collapse the panel by default on small/touch screens so it doesn't bury the map.
	let open = $state(true);
	onMount(() => {
		if (window.matchMedia('(max-width: 640px)').matches) open = false;
	});
</script>

<div class="panel" class:open>
	<button class="header" onclick={() => (open = !open)} aria-expanded={open}>
		<span class="mark" aria-hidden="true">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
				<circle cx="12" cy="10" r="2.5" />
			</svg>
		</span>
		<span class="titles">
			<span class="title">Canada Crime Map</span>
			<span class="sub">{region.label}</span>
		</span>
		<span class="chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
	</button>

	<div class="body">
	<label class="field region">
		<span>Region</span>
		<div class="select-wrap">
			<select value={region.id} onchange={onRegionChange}>
				{#each regions as r}
					<option value={r.id}>{r.label}</option>
				{/each}
			</select>
			<span class="caret" aria-hidden="true">▾</span>
		</div>
	</label>

	<div class="range">
		<label class="field">
			<span>From</span>
			<input type="date" bind:value={filters.from} max={filters.to} />
		</label>
		<label class="field">
			<span>To</span>
			<input type="date" bind:value={filters.to} min={filters.from} />
		</label>
	</div>

	<fieldset>
		<legend>Crime type</legend>
		{#if clearanceCounts}
			<p class="cc-legend">
				<span><i class="dot s"></i>solved</span>
				<span><i class="dot o"></i>ongoing</span>
				<span><i class="dot u"></i>unsolved</span>
			</p>
		{/if}
		{#each region.categories as cat}
			{@const cc = clearanceCounts?.[cat]}
			{@const total = cc ? cc.solved + cc.ongoing + cc.unsolved : 0}
			<label class="chk">
				<input
					type="checkbox"
					checked={filters.categories.includes(cat)}
					onchange={() => (filters.categories = toggle(filters.categories, cat))}
				/>
				<span class="chip" style:background={colorFor(cat)}>{@html iconSvg(cat)}</span>
				{#if cc}
					<span
						class="cat"
						title="{cc.solved.toLocaleString()} solved / {cc.ongoing.toLocaleString()} ongoing / {cc.unsolved.toLocaleString()} unsolved"
					>
						<span class="cat-top">
							<span class="cat-name">{labelFor(cat)}</span>
							<span class="total">{total.toLocaleString()}</span>
						</span>
						<span class="bar">
							{#if total}
								<i class="seg s" style:width="{(cc.solved / total) * 100}%"></i>
								<i class="seg o" style:width="{(cc.ongoing / total) * 100}%"></i>
								<i class="seg u" style:width="{(cc.unsolved / total) * 100}%"></i>
							{/if}
						</span>
						<span class="counts">
							<span><i class="dot s"></i>{cc.solved.toLocaleString()}</span>
							<span><i class="dot o"></i>{cc.ongoing.toLocaleString()}</span>
							<span><i class="dot u"></i>{cc.unsolved.toLocaleString()}</span>
						</span>
					</span>
				{:else}
					{labelFor(cat)}
				{/if}
			</label>
		{/each}
	</fieldset>

	{#if region.municipalities.length}
		<fieldset>
			<legend>Municipality</legend>
			{#each topMunis as m}
				{@const g = groupFor(m)}
				{#if g}
					{@const mem = members(g)}
					{@const all = mem.every((c) => filters.municipalities.includes(c))}
					{@const some = mem.some((c) => filters.municipalities.includes(c))}
					<div class="parent-row">
						<label class="chk">
							<input
								type="checkbox"
								checked={all}
								use:indeterminate={some && !all}
								onchange={() => toggleParent(g)}
							/>
							{muniLabel(m)}
						</label>
						<button
							type="button"
							class="disc"
							aria-expanded={!collapsed[m]}
							aria-label="Toggle communities"
							onclick={() => (collapsed[m] = !collapsed[m])}>{collapsed[m] ? '▸' : '▾'}</button
						>
					</div>
					{#if !collapsed[m]}
						{#each g.children as c}
							<label class="chk child">
								<input
									type="checkbox"
									checked={filters.municipalities.includes(c)}
									onchange={() => (filters.municipalities = toggle(filters.municipalities, c))}
								/>
								{muniLabel(c)}
							</label>
						{/each}
					{/if}
				{:else}
					<label class="chk">
						<input
							type="checkbox"
							checked={filters.municipalities.includes(m)}
							onchange={() => (filters.municipalities = toggle(filters.municipalities, m))}
						/>
						{muniLabel(m)}
					</label>
				{/if}
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

	</div>

	<div class="footer">
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
		display: flex;
		flex-direction: column;
		width: 260px;
		max-height: calc(100% - 24px);
		overflow: hidden;
		background: rgba(255, 255, 255, 0.97);
		border-radius: 14px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
		font: 13px/1.4 system-ui, sans-serif;
		color: #1a1a1a;
	}
	.header {
		display: flex;
		align-items: center;
		gap: 11px;
		width: 100%;
		padding: 13px 16px;
		border: none;
		border-radius: 14px 14px 0 0;
		background: linear-gradient(135deg, #166534, #15803d);
		cursor: pointer;
		text-align: left;
		color: #fff;
		font: inherit;
		flex: 0 0 auto;
	}
	.mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		flex: 0 0 auto;
		border-radius: 9px;
		background: rgba(255, 255, 255, 0.16);
	}
	.mark svg {
		width: 19px;
		height: 19px;
	}
	.titles {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.title {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}
	.sub {
		color: rgba(255, 255, 255, 0.8);
		font-size: 11.5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chevron {
		color: rgba(255, 255, 255, 0.85);
		font-size: 13px;
		flex: 0 0 auto;
	}
	/* Collapsed: hide everything but the header. */
	.panel:not(.open) .body {
		display: none;
	}
	.body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 14px 16px;
		scrollbar-gutter: stable;
		scrollbar-width: thin;
		scrollbar-color: #c3c9d2 transparent;
		-webkit-overflow-scrolling: touch;
	}
	.body::-webkit-scrollbar {
		width: 8px;
	}
	.body::-webkit-scrollbar-thumb {
		background: #c3c9d2;
		border-radius: 4px;
		border: 2px solid transparent;
		background-clip: padding-box;
	}
	.body::-webkit-scrollbar-thumb:hover {
		background: #a7b0bd;
		background-clip: padding-box;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-bottom: 10px;
	}
	.field > span {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #6b7280;
	}
	.range {
		display: flex;
		gap: 10px;
	}
	.range .field {
		flex: 1;
		min-width: 0;
	}
	/* Shared control look for select + date inputs. */
	.region select,
	.field input[type='date'] {
		width: 100%;
		min-height: 36px;
		padding: 7px 10px;
		box-sizing: border-box;
		border: 1px solid #d7dce3;
		border-radius: 9px;
		background: #fff;
		font: inherit;
		color: #1a1a1a;
		transition: border-color 0.12s, box-shadow 0.12s;
	}
	.region select:focus,
	.field input[type='date']:focus {
		outline: none;
		border-color: #15803d;
		box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.15);
	}
	.select-wrap {
		position: relative;
	}
	.region select {
		appearance: none;
		-webkit-appearance: none;
		padding-right: 28px;
		cursor: pointer;
	}
	.caret {
		position: absolute;
		right: 11px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
		font-size: 11px;
		color: #6b7280;
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
	/* Nested municipality groups: parent row carries a disclosure toggle; children indent. */
	.parent-row {
		display: flex;
		align-items: center;
	}
	.parent-row .chk {
		flex: 1;
		min-width: 0;
	}
	.disc {
		flex: 0 0 auto;
		border: none;
		background: none;
		cursor: pointer;
		color: #888;
		font-size: 12px;
		line-height: 1;
		padding: 6px 8px;
	}
	.chk.child {
		margin-left: 26px;
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
	/* Clearance row: name + total, a thin proportion bar, then dot-keyed counts.
	   Every row shares the structure, so the numbers align by construction. */
	.cat {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 2px 0;
	}
	.cat-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.cat-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.total {
		font-size: 11px;
		font-weight: 600;
		color: #888;
		font-variant-numeric: tabular-nums;
	}
	.bar {
		display: flex;
		height: 4px;
		border-radius: 2px;
		overflow: hidden;
		background: #eceff3;
	}
	.seg {
		display: block;
		height: 100%;
	}
	.counts {
		display: flex;
		gap: 12px;
		font-size: 10.5px;
		color: #667;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.counts span,
	.cc-legend span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex: 0 0 auto;
	}
	.s {
		background: #16a34a;
	}
	.o {
		background: #f59e0b;
	}
	.u {
		background: #a8b3c0;
	}
	.cc-legend {
		display: flex;
		gap: 12px;
		margin: 0 0 2px;
		font-size: 10.5px;
		color: #888;
	}
	/* Footer pinned below the scrolling body so the live count stays visible. */
	.footer {
		flex: 0 0 auto;
		padding: 10px 16px;
		border-top: 1px solid #e2e2e2;
		background: rgba(255, 255, 255, 0.97);
		border-radius: 0 0 14px 14px;
	}
	.panel:not(.open) .footer {
		display: none;
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
		.region select,
		.field input[type='date'] {
			min-height: 42px;
			font-size: 16px; /* prevents iOS zoom-on-focus */
		}
	}
</style>
