import type { RegionConfig } from './types';

/**
 * Peel's OccType is a 3-letter code. Map code -> human label + color.
 * Colors keyed by the same code so map/legend/popup stay consistent.
 */
export const CATEGORY_LABELS: Record<string, string> = {
	ASL: 'Assault',
	BNE: 'Break & Enter',
	DRP: 'Drugs — Possession',
	DRT: 'Drugs — Trafficking',
	FRA: 'Fraud',
	HOM: 'Homicide',
	MIS: 'Mischief',
	ROB: 'Robbery',
	VEH: 'Auto Theft'
};

export const CATEGORY_COLORS: Record<string, string> = {
	ASL: '#e6194b',
	BNE: '#ffe119',
	DRP: '#911eb4',
	DRT: '#f032e6',
	FRA: '#4363d8',
	HOM: '#000000',
	MIS: '#808000',
	ROB: '#f58231',
	VEH: '#3cb44b'
};

export const DEFAULT_COLOR = '#808080';

export function colorFor(category: string): string {
	return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

export function labelFor(category: string): string {
	return CATEGORY_LABELS[category] ?? category;
}

/** UPPERCASE municipality codes -> title case for display. */
export function muniLabel(m: string): string {
	const fix: Record<string, string> = { HALTONHILLS: 'Halton Hills', RICHMONDHILL: 'Richmond Hill' };
	return fix[m] ?? m.charAt(0) + m.slice(1).toLowerCase();
}

/**
 * Region registry. Peel is first; add Toronto/York/etc. by appending a config.
 * Peel layer = the "Experience_gdb" Ecrimes FeatureServer behind Peel's Crime
 * Occurrence Map (captured from the live app). Fields confirmed via `?f=json`.
 */
export const REGIONS: RegionConfig[] = [
	{
		id: 'peel',
		label: 'Peel Region (Brampton / Mississauga / Caledon)',
		layerUrl:
			'https://services.arcgis.com/w0dAT1ctgtKwxvde/arcgis/rest/services/Experience_gdb/FeatureServer/0',
		fieldMap: {
			id: 'OBJECTID',
			category: 'OccType',
			date: 'OccDateUTC',
			municipality: 'Municipality',
			description: 'Description',
			address: 'StreetName'
		},
		center: [-79.74, 43.65],
		zoom: 10.5,
		categories: ['ASL', 'BNE', 'ROB', 'VEH', 'FRA', 'MIS', 'DRP', 'DRT', 'HOM'],
		municipalities: ['BRAMPTON', 'MISSISSAUGA', 'CALEDON'],
		verified: true
	}
];

export const DEFAULT_REGION = REGIONS[0];
