// Basemap registry + persistence. Mirrors the regions.ts pattern: a static catalog of
// tile services, each with one or more styles. All entries are tokenless and CORS-enabled.

export type BasemapSpec =
	| { kind: 'url'; url: string } // a full MapLibre vector style.json URL
	| { kind: 'raster'; tiles: string[]; attribution: string };

export interface BasemapStyle {
	id: string;
	label: string;
	spec: BasemapSpec;
}

export interface BasemapService {
	id: string;
	label: string;
	styles: BasemapStyle[];
}

export interface BasemapPref {
	service: string;
	style: string;
}

/** Shared glyph endpoint — forced onto every style so the cluster-count font always loads. */
export const GLYPHS = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';

const ofm = (name: string): BasemapSpec => ({
	kind: 'url',
	url: `https://tiles.openfreemap.org/styles/${name}`
});
const carto = (name: string): BasemapSpec => ({
	kind: 'url',
	url: `https://basemaps.cartocdn.com/gl/${name}-gl-style/style.json`
});

export const BASEMAPS: BasemapService[] = [
	{
		id: 'openfreemap',
		label: 'OpenFreeMap',
		styles: [
			{ id: 'liberty', label: 'Liberty (Google-like)', spec: ofm('liberty') },
			{ id: 'bright', label: 'Bright', spec: ofm('bright') },
			{ id: 'positron', label: 'Positron (light)', spec: ofm('positron') },
			{ id: 'dark', label: 'Dark', spec: ofm('dark') }
		]
	},
	{
		id: 'carto',
		label: 'Carto',
		styles: [
			{ id: 'voyager', label: 'Voyager', spec: carto('voyager') },
			{ id: 'positron', label: 'Positron (light)', spec: carto('positron') },
			{ id: 'dark-matter', label: 'Dark Matter', spec: carto('dark-matter') }
		]
	},
	{
		id: 'osm',
		label: 'OpenStreetMap',
		styles: [
			{
				id: 'standard',
				label: 'Standard',
				spec: {
					kind: 'raster',
					tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
					attribution: '© OpenStreetMap contributors'
				}
			}
		]
	}
];

export const DEFAULT_BASEMAP: BasemapPref = { service: 'openfreemap', style: 'liberty' };

/** Resolve a service+style pair to its spec, falling back to the default basemap. */
export function resolveSpec(service: string, style: string): BasemapSpec {
	const svc = BASEMAPS.find((s) => s.id === service);
	const st = svc?.styles.find((x) => x.id === style) ?? svc?.styles[0];
	if (st) return st.spec;
	const def = BASEMAPS.find((s) => s.id === DEFAULT_BASEMAP.service)!;
	return def.styles.find((x) => x.id === DEFAULT_BASEMAP.style)!.spec;
}

const LS_KEY = 'ccm:basemap';

export function loadBasemapPref(): BasemapPref {
	try {
		const raw = localStorage.getItem(LS_KEY);
		if (raw) {
			const p = JSON.parse(raw) as BasemapPref;
			// Validate against the catalog so a removed style can't strand the map.
			const svc = BASEMAPS.find((s) => s.id === p.service);
			if (svc?.styles.some((x) => x.id === p.style)) return p;
		}
	} catch {
		// localStorage unavailable / malformed — fall through to default.
	}
	return DEFAULT_BASEMAP;
}

export function saveBasemapPref(p: BasemapPref): void {
	try {
		localStorage.setItem(LS_KEY, JSON.stringify(p));
	} catch {
		// Quota/unavailable — preference simply won't persist.
	}
}
