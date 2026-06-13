<script lang="ts">
	import { BASEMAPS, type BasemapPref } from '../map/basemaps';

	let { basemap = $bindable() }: { basemap: BasemapPref } = $props();

	let open = $state(false);

	const service = $derived(BASEMAPS.find((s) => s.id === basemap.service) ?? BASEMAPS[0]);

	function onServiceChange(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		const svc = BASEMAPS.find((s) => s.id === id) ?? BASEMAPS[0];
		// Reset to the new service's first style — style ids aren't shared across services.
		basemap = { service: svc.id, style: svc.styles[0].id };
	}

	function onStyleChange(e: Event) {
		basemap = { ...basemap, style: (e.currentTarget as HTMLSelectElement).value };
	}

	// Close on outside click / Escape while open.
	function onWindowClick(e: MouseEvent) {
		if (!(e.target as HTMLElement).closest('.basemap')) open = false;
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} />

<div class="basemap">
	{#if open}
		<div class="popover">
			<p class="title">Map style</p>
			<label class="field">
				<span>Service</span>
				<select value={basemap.service} onchange={onServiceChange}>
					{#each BASEMAPS as s}
						<option value={s.id}>{s.label}</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span>Style</span>
				<select value={basemap.style} onchange={onStyleChange}>
					{#each service.styles as st}
						<option value={st.id}>{st.label}</option>
					{/each}
				</select>
			</label>
		</div>
	{/if}
	<button
		class="gear"
		aria-label="Map style settings"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
		</svg>
	</button>
</div>

<style>
	.basemap {
		position: absolute;
		right: 12px;
		bottom: 38px; /* sit above the MapLibre attribution pill (bottom-right) */
		z-index: 6;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		font: 13px/1.4 system-ui, sans-serif;
		color: #1a1a1a;
	}
	.gear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.97);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
		color: #15803d;
		cursor: pointer;
	}
	.gear svg {
		width: 21px;
		height: 21px;
	}
	.gear:hover {
		background: #fff;
	}
	.popover {
		width: 220px;
		padding: 12px 14px 14px;
		background: rgba(255, 255, 255, 0.98);
		border-radius: 12px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
	}
	.title {
		margin: 0 0 10px;
		font-size: 13px;
		font-weight: 700;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-bottom: 10px;
	}
	.field:last-child {
		margin-bottom: 0;
	}
	.field > span {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #6b7280;
	}
	select {
		width: 100%;
		min-height: 36px;
		padding: 7px 10px;
		box-sizing: border-box;
		border: 1px solid #d7dce3;
		border-radius: 9px;
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
	@media (max-width: 640px) {
		select {
			min-height: 42px;
			font-size: 16px; /* prevents iOS zoom-on-focus */
		}
		/* Panel docks as a bottom sheet on mobile, so move the gear to the free top-left
		   corner; column-reverse puts the button on top with the popover opening below it. */
		.basemap {
			top: 12px;
			bottom: auto;
			left: 12px;
			right: auto;
			align-items: flex-start;
			flex-direction: column-reverse;
		}
	}
</style>
