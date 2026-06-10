<script lang="ts">
	import type { CrimeProps } from '../data/types';
	import { colorFor, labelFor, muniLabel } from '../data/regions';

	let { incident, onClose }: { incident: CrimeProps | null; onClose: () => void } = $props();

	function fmt(iso: string): string {
		const d = new Date(iso);
		return isNaN(d.getTime())
			? iso
			: d.toLocaleString('en-CA', {
					dateStyle: 'full',
					timeStyle: 'short'
				});
	}
</script>

{#if incident}
	<div class="detail">
		<button class="close" onclick={onClose} aria-label="Close">×</button>
		<div class="head">
			<span class="dot" style:background={colorFor(incident.category)}></span>
			<h2>{labelFor(incident.category)}</h2>
		</div>
		{#if incident.description}<p class="desc">{incident.description}</p>{/if}
		<dl>
			<dt>Date</dt>
			<dd>{fmt(incident.date)}</dd>
			{#if incident.municipality}
				<dt>Municipality</dt>
				<dd>{muniLabel(incident.municipality)}</dd>
			{/if}
			{#if incident.address}
				<dt>Location</dt>
				<dd>{incident.address}</dd>
			{/if}
			<dt>ID</dt>
			<dd>{incident.id}</dd>
		</dl>
		<p class="approx">Locations are approximate (geocoded to the nearest intersection).</p>
	</div>
{/if}

<style>
	.detail {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 5;
		width: 270px;
		padding: 14px 16px;
		background: rgba(255, 255, 255, 0.97);
		border-radius: 10px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
		font: 13px/1.45 system-ui, sans-serif;
		color: #1a1a1a;
	}
	.close {
		position: absolute;
		top: 6px;
		right: 8px;
		border: none;
		background: none;
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
		color: #777;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-right: 18px;
	}
	h2 {
		margin: 0;
		font-size: 16px;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex: 0 0 auto;
	}
	.desc {
		margin: 8px 0;
		color: #444;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 12px;
		margin: 10px 0 0;
	}
	dt {
		color: #777;
	}
	dd {
		margin: 0;
		font-weight: 500;
	}
	.approx {
		margin: 12px 0 0;
		font-size: 11px;
		color: #999;
	}
</style>
