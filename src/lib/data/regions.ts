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
	// Peel (OccType codes)
	ASL: '#e6194b',
	BNE: '#ffe119',
	DRP: '#911eb4',
	DRT: '#f032e6',
	FRA: '#4363d8',
	HOM: '#000000',
	MIS: '#808000',
	ROB: '#f58231',
	VEH: '#3cb44b',
	// Toronto (CSI_CATEGORY values)
	Assault: '#e6194b',
	'Break and Enter': '#ffe119',
	'Auto Theft': '#3cb44b',
	Robbery: '#f58231',
	'Theft Over': '#911eb4'
};

export const DEFAULT_COLOR = '#808080';

export function colorFor(category: string): string {
	return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

export function labelFor(category: string): string {
	return CATEGORY_LABELS[category] ?? category;
}

/** Clearance status -> badge color; unrecognized statuses fall back to grey. */
const CLEARANCE_COLORS: Record<string, string> = {
	Solved: '#16a34a',
	Ongoing: '#d97706',
	Unsolved: '#6b7280'
};

export function clearanceColor(status: string): string {
	return CLEARANCE_COLORS[status] ?? '#6b7280';
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
			address: 'StreetName',
			clearance: 'ClearanceStatus' // Solved / Unsolved / Ongoing
		},
		center: [-79.74, 43.65],
		zoom: 10.5,
		bounds: [-80.3, 43.45, -79.53, 44.0],
		categories: ['ASL', 'BNE', 'ROB', 'VEH', 'FRA', 'MIS', 'DRP', 'DRT', 'HOM'],
		municipalities: ['BRAMPTON', 'MISSISSAUGA', 'CALEDON'],
		// Official Peel "Municipal Boundary" layer; MUN_NAME = Brampton/Mississauga/Caledon.
		boundary: {
			url: 'https://services6.arcgis.com/ONZht79c8QWuX759/arcgis/rest/services/Municipal_Boundary/FeatureServer/0',
			nameField: 'MUN_NAME'
		},
		verified: true
	},
	{
		id: 'toronto',
		label: 'Toronto (city-wide)',
		layerUrl:
			'https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/Major_Crime_Indicators_Open_Data/FeatureServer/0',
		fieldMap: {
			id: 'EVENT_UNIQUE_ID',
			category: 'CSI_CATEGORY',
			date: 'OCC_DATE',
			municipality: 'DIVISION',
			description: 'OFFENCE',
			address: 'LOCATION_TYPE'
		},
		center: [-79.38, 43.72],
		zoom: 10.5,
		bounds: [-79.64, 43.57, -79.11, 43.86],
		// Toronto Police "Major Crime Indicators" CSI categories.
		categories: ['Assault', 'Break and Enter', 'Auto Theft', 'Robbery', 'Theft Over'],
		// No municipal sub-filter (single city); Etobicoke etc. are districts within Toronto.
		municipalities: [],
		verified: true
	}
];

export const DEFAULT_REGION = REGIONS[0];
