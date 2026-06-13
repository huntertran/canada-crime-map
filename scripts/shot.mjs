// Dev self-verify: load the running app in headless Chromium, capture console errors,
// probe the live MapLibre map (exposed as window.__map in dev), and screenshot.
//   URL=http://localhost:5173/ OUT=shot.png node scripts/shot.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173/';
const OUT = process.env.OUT || 'scripts/shot.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(11000); // style load + data fetch + overlay add

const probe = await page.evaluate(() => {
	const m = window.__map;
	if (!m) return { hasMap: false };
	const q = (l) => (m.getLayer(l) ? m.queryRenderedFeatures({ layers: [l] }).length : 'no-layer');
	return {
		hasMap: true,
		styleLoaded: m.isStyleLoaded(),
		crimeFeaturesInSource: (() => {
			try {
				return m.querySourceFeatures('crimes').length;
			} catch {
				return 'n/a';
			}
		})(),
		rendered: { clusters: q('crimes-clusters'), unclustered: q('crimes-unclustered') }
	};
});

console.log('PROBE', JSON.stringify(probe));
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'));

await page.screenshot({ path: OUT });
console.log('shot ->', OUT);
await browser.close();
