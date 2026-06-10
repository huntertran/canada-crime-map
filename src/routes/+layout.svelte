<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		height: 100%;
		font-family: system-ui, sans-serif;
	}
</style>
