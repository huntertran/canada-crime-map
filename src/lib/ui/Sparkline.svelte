<script lang="ts">
	import { DAY, fmtDay, windowLabel, type Bucket, type StepSize } from '../data/timeline';

	let {
		buckets,
		size,
		active = null,
		onSeek,
		loading = false
	}: {
		buckets: Bucket[];
		size: StepSize;
		/** Time-slider window to highlight (null while the timeline is closed). */
		active?: number | null;
		/** Jump the time slider to a window; only offered while `active` is set. */
		onSeek?: (i: number) => void;
		/** Data is reloading: hold the previous line at reduced opacity. */
		loading?: boolean;
	} = $props();

	const TITLES: Record<StepSize, string> = {
		day: 'Daily incidents',
		week: 'Weekly incidents',
		month: 'Monthly incidents'
	};
	const H = 44; // plot height (px)
	const PAD_X = 4; // keep end dots inside the box
	const PAD_TOP = 14; // room for the peak label

	const uid = $props.id();
	const summaryId = `trend-${uid}`;
	let width = $state(0);
	let hover = $state<number | null>(null);

	const n = $derived(buckets.length);
	const max = $derived(buckets.reduce((m, b) => Math.max(m, b.count), 0));
	const peak = $derived(buckets.findIndex((b) => b.count === max));
	const seekable = $derived(active !== null && !!onSeek);

	const x = (i: number) =>
		n <= 1 ? width / 2 : PAD_X + (i * (width - 2 * PAD_X)) / (n - 1);
	const y = (c: number) => (max === 0 ? H - 1 : H - 1 - (c / max) * (H - 1 - PAD_TOP));

	// Solid line through complete windows; a trailing partial window is drawn dashed so a
	// short last week doesn't read as a drop.
	const lastFull = $derived(n > 0 && buckets[n - 1].partial ? n - 2 : n - 1);
	const pts = $derived(buckets.map((b, i) => `${x(i).toFixed(1)},${y(b.count).toFixed(1)}`));
	const line = $derived(lastFull >= 0 ? 'M' + pts.slice(0, lastFull + 1).join('L') : '');
	const tail = $derived(lastFull < n - 1 && n > 1 ? `M${pts[n - 2]}L${pts[n - 1]}` : '');
	const area = $derived(
		n > 1 ? `M${x(0)},${H}L${pts.join('L')}L${x(n - 1)},${H}Z` : ''
	);
	const step = $derived(n > 1 ? (width - 2 * PAD_X) / (n - 1) : width);

	function days(b: Bucket): number {
		return Math.round((b.end - b.start) / DAY);
	}
	function readout(i: number): string {
		const b = buckets[i];
		const note = b.partial ? ` (partial, ${days(b)} days)` : '';
		return `${b.count.toLocaleString()} incidents · ${windowLabel(b.start, b.end)}${note}`;
	}

	const summary = $derived(
		n === 0
			? `${TITLES[size]}: no data`
			: `${TITLES[size]}, ${fmtDay(buckets[0].start)} to ${fmtDay(buckets[n - 1].end - DAY)}: ` +
					`peak ${max} (${windowLabel(buckets[peak].start, buckets[peak].end)}), ` +
					`latest ${buckets[n - 1].count}${buckets[n - 1].partial ? ' (partial)' : ''}`
	);

	function indexAt(clientX: number, el: Element): number {
		const px = clientX - el.getBoundingClientRect().left;
		return Math.max(0, Math.min(n - 1, Math.round((px - PAD_X) / (step || 1))));
	}

	function onKey(e: KeyboardEvent) {
		if (n === 0) return;
		const cur = hover ?? active ?? n - 1;
		const next =
			e.key === 'ArrowLeft'
				? cur - 1
				: e.key === 'ArrowRight'
					? cur + 1
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? n - 1
							: null;
		if (next === null) return;
		e.preventDefault();
		hover = Math.max(0, Math.min(n - 1, next));
		if (seekable) onSeek!(hover);
	}
</script>

<div class="trend" class:loading>
	<div class="head">
		<span class="title">{TITLES[size]}</span>
		{#if seekable}<span class="hint">click to jump</span>{/if}
	</div>
	<!-- Arrow keys move the readout (and seek the time slider while it's open). -->
	<div
		class="plot"
		class:seekable
		bind:clientWidth={width}
		style:height="{H}px"
		tabindex="0"
		role="slider"
		aria-label={TITLES[size]}
		aria-describedby={summaryId}
		aria-valuemin={0}
		aria-valuemax={Math.max(n - 1, 0)}
		aria-valuenow={hover ?? active ?? Math.max(n - 1, 0)}
		aria-valuetext={n ? readout(hover ?? active ?? n - 1) : 'No data'}
		onpointermove={(e) => n && (hover = indexAt(e.clientX, e.currentTarget))}
		onpointerleave={() => (hover = null)}
		onclick={(e) => n && seekable && onSeek!(indexAt(e.clientX, e.currentTarget))}
		onkeydown={onKey}
		onfocus={() => (hover = active ?? n - 1)}
		onblur={() => (hover = null)}
	>
		{#if width > 0 && n > 0}
			<svg {width} height={H} aria-hidden="true">
				{#if active !== null && active < n}
					<rect
						class="band"
						x={Math.max(0, x(active) - step / 2)}
						y="0"
						width={Math.min(step, width)}
						height={H}
					/>
				{/if}
				<line class="base" x1="0" x2={width} y1={H - 0.5} y2={H - 0.5} />
				{#if max > 0}
					<path class="area" d={area} />
					<path class="line" d={line} />
					{#if tail}<path class="line tail" d={tail} />{/if}
					<circle class="dot" cx={x(peak)} cy={y(max)} r="2.5" />
				{/if}
				{#if hover !== null}
					<line class="cross" x1={x(hover)} x2={x(hover)} y1="0" y2={H} />
					<circle class="dot hover" cx={x(hover)} cy={y(buckets[hover].count)} r="4" />
				{/if}
			</svg>
			{#if max > 0}
				<span
					class="peak"
					style:left="{Math.min(Math.max(x(peak), 14), width - 14)}px"
					style:top="{y(max) - 15}px">{max}</span
				>
			{:else}
				<span class="empty">No incidents in range</span>
			{/if}
			{#if hover !== null}
				<div
					class="tip"
					style:left="{Math.min(Math.max(x(hover), 70), width - 70)}px"
				>
					<strong>{buckets[hover].count.toLocaleString()}</strong>
					<span>{windowLabel(buckets[hover].start, buckets[hover].end)}</span>
					{#if buckets[hover].partial}<span class="muted">partial · {days(buckets[hover])} days</span>{/if}
				</div>
			{/if}
		{/if}
	</div>
	{#if n > 0}
		<div class="axis" aria-hidden="true">
			<span>{fmtDay(buckets[0].start, false)}</span>
			<span>{fmtDay(buckets[n - 1].end - DAY, false)}</span>
		</div>
	{/if}
	<p class="sr-only" id={summaryId}>{summary}</p>
	<table class="sr-only">
		<caption>{TITLES[size]}</caption>
		<thead><tr><th>Period</th><th>Incidents</th></tr></thead>
		<tbody>
			{#each buckets as b (b.start)}
				<tr>
					<td>{windowLabel(b.start, b.end)}{b.partial ? ' (partial)' : ''}</td>
					<td>{b.count}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.trend {
		margin: 2px 0 10px;
		transition: opacity 0.15s;
	}
	.trend.loading {
		opacity: 0.5;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 2px;
	}
	.title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #6b7280;
	}
	.hint {
		font-size: 11px;
		color: #9ca3af;
	}
	.plot {
		position: relative;
		border-radius: 6px;
		outline: none;
		touch-action: pan-y;
	}
	.plot.seekable {
		cursor: pointer;
	}
	.plot:focus-visible {
		box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.25);
	}
	svg {
		display: block;
		overflow: visible;
	}
	.band {
		fill: rgba(17, 24, 39, 0.08);
	}
	.base {
		stroke: #e2e2e2;
		stroke-width: 1;
	}
	.area {
		fill: rgba(21, 128, 61, 0.12);
	}
	.line {
		fill: none;
		stroke: #15803d;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.tail {
		stroke-dasharray: 3 3;
	}
	.dot {
		fill: #15803d;
	}
	.dot.hover {
		stroke: #fff;
		stroke-width: 2;
	}
	.cross {
		stroke: #6b7280;
		stroke-width: 1;
	}
	.peak {
		position: absolute;
		transform: translateX(-50%);
		font-size: 11px;
		font-weight: 600;
		color: #1a1a1a;
		pointer-events: none;
	}
	.empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		color: #6b7280;
	}
	.tip {
		position: absolute;
		bottom: calc(100% + 6px);
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		flex-direction: column;
		padding: 5px 9px;
		border-radius: 8px;
		background: #1f2937;
		color: #e5e7eb;
		font-size: 12px;
		line-height: 1.35;
		white-space: nowrap;
		pointer-events: none;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}
	.tip strong {
		color: #fff;
		font-size: 14px;
	}
	.tip .muted {
		color: #9ca3af;
	}
	.axis {
		display: flex;
		justify-content: space-between;
		margin-top: 3px;
		font-size: 11px;
		color: #6b7280;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
