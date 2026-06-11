import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// On GitHub Pages a project site is served from /<repo>/, so prod needs a base path.
// CI sets BASE_PATH=/canada-crime-map; local dev/preview leave it empty.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			paths: { base },

			// Static SPA: emit a 404.html fallback so GitHub Pages serves the client
			// router on deep links; all data is fetched client-side at runtime.
			adapter: adapter({ fallback: '404.html' })
		})
	]
});
