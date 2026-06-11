import type { RegionConfig } from './types';
import { muniLabel } from './regions';

/** Loose GeoJSON polygon collection — geometry passed straight to MapLibre. */
export interface BoundaryCollection {
	type: 'FeatureCollection';
	features: unknown[];
}

export const EMPTY_BOUNDARY: BoundaryCollection = { type: 'FeatureCollection', features: [] };

// Boundaries are static; cache per region + selected set so toggling is instant.
const cache = new Map<string, BoundaryCollection>();

/**
 * Fetch the outline polygons for the selected municipalities from the region's
 * boundary layer (ArcGIS GeoJSON). Returns an empty collection when nothing is
 * selected or the region has no boundary layer.
 */
export async function loadBoundaries(
	region: RegionConfig,
	muniCodes: string[],
	signal?: AbortSignal
): Promise<BoundaryCollection> {
	if (!region.boundary || muniCodes.length === 0) return EMPTY_BOUNDARY;

	// Map our UPPERCASE codes onto the layer's title-case MUN_NAME values.
	const names = muniCodes.map(muniLabel);
	const key = region.id + '|' + [...names].sort().join(',');
	const hit = cache.get(key);
	if (hit) return hit;

	const list = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(', ');
	const url = new URL(region.boundary.url.replace(/\/$/, '') + '/query');
	url.search = new URLSearchParams({
		where: `${region.boundary.nameField} IN (${list})`,
		outFields: region.boundary.nameField,
		outSR: '4326',
		f: 'geojson'
	}).toString();

	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(`ArcGIS ${res.status} ${res.statusText}`);
	const json = await res.json();
	if (json.error) throw new Error(`ArcGIS error: ${json.error.message ?? 'unknown'}`);

	const fc: BoundaryCollection = { type: 'FeatureCollection', features: json.features ?? [] };
	cache.set(key, fc);
	return fc;
}
