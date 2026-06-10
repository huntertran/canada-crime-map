// Single-page app: no SSR, render everything in the browser. The static adapter
// emits an index.html fallback (see vite.config.ts) that boots the client router.
export const ssr = false;
export const prerender = false;
