<script lang="ts">
	import {
		DAY,
		SPEEDS,
		STEP_SIZES,
		stepIndexAt,
		type StepSize,
		type TimelineState
	} from '../data/timeline';

	let {
		timeline = $bindable(),
		origin,
		steps,
		step,
		start,
		end,
		count
	}: {
		timeline: TimelineState;
		/** Range start (ms), used to keep the playhead in place when the window size changes. */
		origin: number;
		steps: number;
		/** Current window index, already clamped to the range. */
		step: number;
		/** Current window as a half-open [start, end) ms range. */
		start: number;
		end: number;
		count: number;
	} = $props();

	// Window bounds are UTC midnights, so format in UTC to keep the label on the right day.
	function fmt(t: number, year: boolean): string {
		if (Number.isNaN(t)) return '—';
		return new Date(t).toLocaleDateString('en-CA', {
			month: 'short',
			day: 'numeric',
			year: year ? 'numeric' : undefined,
			timeZone: 'UTC'
		});
	}

	const label = $derived.by(() => {
		const last = end - DAY; // end is exclusive
		if (last <= start) return fmt(start, true);
		return `${fmt(start, false)} – ${fmt(last, true)}`;
	});

	function togglePlay() {
		// Pressing play at the end restarts from the beginning.
		if (!timeline.playing && step >= steps - 1) timeline.step = 0;
		timeline.playing = !timeline.playing;
	}

	function setSize(size: StepSize) {
		// Keep the playhead on the same date rather than the same index.
		timeline.step = stepIndexAt(origin, size, start);
		timeline.size = size;
	}

	function close() {
		timeline.playing = false;
		timeline.open = false;
	}
</script>

{#if !timeline.open}
	<button class="open" onclick={() => (timeline.open = true)}>
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
		Timeline
	</button>
{:else}
	<div class="bar" role="group" aria-label="Timeline">
		<button
			class="play"
			onclick={togglePlay}
			aria-label={timeline.playing ? 'Pause' : 'Play'}
			title={timeline.playing ? 'Pause' : 'Play'}
		>
			{#if timeline.playing}
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
			{:else}
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
			{/if}
		</button>
		<div class="track">
			<div class="label">
				<strong>{timeline.cumulative ? `Through ${fmt(end - DAY, true)}` : label}</strong>
				<span class="count">{count.toLocaleString()} incidents</span>
			</div>
			<input
				type="range"
				min="0"
				max={Math.max(steps - 1, 0)}
				value={step}
				oninput={(e) => (timeline.step = +e.currentTarget.value)}
				aria-label="Timeline position"
			/>
		</div>
		<div class="opts">
			<select
				value={timeline.size}
				onchange={(e) => setSize(e.currentTarget.value as StepSize)}
				aria-label="Window size"
			>
				{#each STEP_SIZES as s (s.id)}
					<option value={s.id}>{s.label}</option>
				{/each}
			</select>
			<select bind:value={timeline.speed} aria-label="Playback speed">
				{#each SPEEDS as s (s)}
					<option value={s}>{s}×</option>
				{/each}
			</select>
			<label class="chk">
				<input type="checkbox" bind:checked={timeline.cumulative} />
				Cumulative
			</label>
			<button class="close" onclick={close} aria-label="Close timeline" title="Close timeline">
				<svg viewBox="0 0 24 24" aria-hidden="true"
					><path
						d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z"
					/></svg
				>
			</button>
		</div>
	</div>
{/if}

<style>
	.open,
	.bar {
		position: absolute;
		z-index: 5;
		font: 13px/1.4 system-ui, sans-serif;
		color: #1a1a1a;
		background: rgba(255, 255, 255, 0.97);
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
	}
	svg {
		width: 18px;
		height: 18px;
		fill: currentColor;
	}
	.open {
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px 8px 12px;
		border: none;
		border-radius: 20px;
		font-weight: 600;
		color: #15803d;
		cursor: pointer;
	}
	.open:hover {
		background: #fff;
	}
	.bar {
		/* Between the filter panel (left, 260px + 12px gutter) and the basemap gear (right),
		   lifted clear of the MapLibre attribution line along the bottom edge. */
		bottom: 34px;
		left: 290px;
		right: 70px;
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 14px;
	}
	.play {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: none;
		border-radius: 50%;
		background: #15803d;
		color: #fff;
		cursor: pointer;
	}
	.play:hover {
		background: #166534;
	}
	.track {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.label {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		white-space: nowrap;
	}
	.label strong {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.count {
		color: #6b7280;
		font-variant-numeric: tabular-nums;
	}
	input[type='range'] {
		width: 100%;
		margin: 4px 0;
		accent-color: #15803d;
		cursor: pointer;
	}
	.opts {
		flex: none;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	select {
		min-height: 32px;
		padding: 4px 8px;
		border: 1px solid #d7dce3;
		border-radius: 8px;
		background: #fff;
		font: inherit;
		color: #1a1a1a;
		cursor: pointer;
	}
	select:focus {
		outline: none;
		border-color: #15803d;
		box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.15);
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		cursor: pointer;
	}
	.chk input {
		accent-color: #15803d;
	}
	.close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: #6b7280;
		cursor: pointer;
	}
	.close:hover {
		background: #f1f3f5;
		color: #1a1a1a;
	}

	/* Narrow desktop: options drop under the track. */
	@media (max-width: 1100px) {
		.bar {
			flex-wrap: wrap;
		}
		.track {
			flex-basis: calc(100% - 52px);
		}
		.opts {
			width: 100%;
			justify-content: flex-end;
		}
	}

	/* Phone: the filter panel is a bottom sheet, so the bar moves to the top, between the
	   basemap gear (top-left, 12px + 42px) and the map's zoom/locate controls (right). */
	@media (max-width: 640px) {
		.open {
			top: 12px;
			bottom: auto;
			left: 62px;
			transform: none;
			min-height: 42px;
		}
		.bar {
			top: 8px;
			bottom: auto;
			left: 62px;
			right: 56px;
			padding: 8px 10px;
		}
		.label {
			flex-wrap: wrap;
			column-gap: 8px;
			row-gap: 0;
		}
		.opts {
			flex-wrap: wrap;
			justify-content: flex-start;
			gap: 6px 8px;
		}
		select {
			min-height: 36px;
			font-size: 16px; /* prevents iOS zoom-on-focus */
		}
	}
</style>
