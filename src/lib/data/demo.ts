import type { CrimeCollection, CrimeFeature, RegionConfig, Filters } from './types';

// Deterministic demo data so the app runs end-to-end before the real Peel endpoint
// is wired in. Generates points scattered around the region center.

function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function generateDemo(region: RegionConfig, count = 1200): CrimeCollection {
	const rand = mulberry32(42);
	const [clng, clat] = region.center;
	const now = Date.now();
	const features: CrimeFeature[] = [];

	for (let i = 0; i < count; i++) {
		// Cluster points around a few hotspots to make clustering visually interesting.
		const hot = Math.floor(rand() * 5);
		const hlng = clng + (hot - 2) * 0.06;
		const hlat = clat + (hot - 2) * 0.04;
		const lng = hlng + (rand() - 0.5) * 0.12;
		const lat = hlat + (rand() - 0.5) * 0.08;

		const category = region.categories[Math.floor(rand() * region.categories.length)];
		const municipality =
			region.municipalities[Math.floor(rand() * region.municipalities.length)];
		const daysAgo = Math.floor(rand() * 365 * 3); // within ~36 months
		const date = new Date(now - daysAgo * 86400000).toISOString();

		features.push({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [lng, lat] },
			properties: {
				id: i + 1,
				category,
				date,
				municipality,
				description: `${category} (demo)`,
				address: `${100 + Math.floor(rand() * 9900)} Demo St`
			}
		});
	}

	return { type: 'FeatureCollection', features };
}

/** Apply filters client-side (demo data isn't server-queried). */
export function filterDemo(fc: CrimeCollection, filters: Filters): CrimeCollection {
	const from = new Date(filters.from + 'T00:00:00').getTime();
	const to = new Date(filters.to + 'T23:59:59').getTime();
	const cats = new Set(filters.categories);
	const munis = new Set(filters.municipalities);

	return {
		type: 'FeatureCollection',
		features: fc.features.filter((f) => {
			const t = new Date(f.properties.date).getTime();
			if (t < from || t > to) return false;
			if (cats.size && !cats.has(f.properties.category)) return false;
			if (munis.size && f.properties.municipality && !munis.has(f.properties.municipality))
				return false;
			return true;
		})
	};
}
