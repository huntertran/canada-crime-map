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
	VEH: 'Auto Theft',
	// York (occ_type values) — shorten the long ones; the rest read fine as-is.
	Assaults: 'Assault',
	'Break and Enter - Residential': 'B&E — Residential',
	'Break and Enter - Commercial': 'B&E — Commercial',
	'Theft of Motor Vehicle': 'Auto Theft',
	'Theft Over $5000': 'Theft Over $5K',
	'Theft Under $5000': 'Theft Under $5K',
	'Drug Violations': 'Drugs',
	// Durham (per-layer category, reuses keys above) — only the new one needs a label.
	'Firearm Shooting': 'Shooting',
	// Halton (DESCRIPTION values) — tidy the SHOUTING free-text into readable labels.
	'BREAK AND ENTER HOUSE': 'B&E — House',
	'BREAK AND ENTER SHOP': 'B&E — Shop',
	'BREAK AND ENTER OTHER': 'B&E — Other',
	'THEFT OF VEHICLE': 'Auto Theft',
	'THEFT FROM AUTO': 'Theft from Vehicle',
	'THEFT UNDER': 'Theft Under $5K',
	'THEFT OVER': 'Theft Over $5K',
	'THEFT OF BICYCLE': 'Bicycle Theft',
	ROBBERY: 'Robbery',
	ARSON: 'Arson',
	'OFFENSIVE WEAPONS': 'Weapons',
	'FEDERAL STATS - DRUGS': 'Drugs',
	'PROPERTY DAMAGE UNDER $5,000': 'Property Damage',
	'PROPERTY DAMAGE OVER $5,000': 'Property Damage Over $5K'
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
	Robbery: '#f58231', // shared by York
	'Theft Over': '#911eb4',
	// York (occ_type values)
	Assaults: '#e6194b',
	'Break and Enter - Residential': '#ffe119',
	'Break and Enter - Commercial': '#bfa100',
	'Theft of Motor Vehicle': '#3cb44b',
	'Theft Over $5000': '#911eb4',
	'Theft Under $5000': '#42d4f4',
	Fraud: '#4363d8',
	'Drug Violations': '#f032e6',
	Mischief: '#808000',
	Homicide: '#000000',
	// Durham (new key only; others reuse Toronto/York keys above)
	'Firearm Shooting': '#a8071a',
	// Halton (DESCRIPTION values)
	'BREAK AND ENTER HOUSE': '#ffe119',
	'BREAK AND ENTER SHOP': '#bfa100',
	'BREAK AND ENTER OTHER': '#d4b106',
	'THEFT OF VEHICLE': '#3cb44b',
	'THEFT FROM AUTO': '#2a9d8f',
	'THEFT UNDER': '#42d4f4',
	'THEFT OVER': '#911eb4',
	'THEFT OF BICYCLE': '#4363d8',
	ROBBERY: '#f58231',
	ARSON: '#e6194b',
	'OFFENSIVE WEAPONS': '#a8071a',
	'FEDERAL STATS - DRUGS': '#f032e6',
	'PROPERTY DAMAGE UNDER $5,000': '#808000',
	'PROPERTY DAMAGE OVER $5,000': '#5c5c00'
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
	const fix: Record<string, string> = {
		HALTONHILLS: 'Halton Hills',
		RICHMONDHILL: 'Richmond Hill',
		'HALTON HILLS': 'Halton Hills',
		// Durham municipality codes.
		AJA: 'Ajax',
		BRO: 'Brock',
		CLA: 'Clarington',
		OSH: 'Oshawa',
		PIC: 'Pickering',
		SCU: 'Scugog',
		UXB: 'Uxbridge',
		WHI: 'Whitby'
	};
	if (fix[m]) return fix[m];
	// Already mixed-case (e.g. York's "Richmond Hill") — leave it untouched.
	if (m !== m.toUpperCase()) return m;
	return m.charAt(0) + m.slice(1).toLowerCase();
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
	},
	{
		id: 'york',
		label: 'York Region (Markham / Vaughan / Richmond Hill / Newmarket)',
		// York Regional Police "Year to Date Community Safety Data" — single point
		// layer, occurrences since the start of the current year. Refreshed daily.
		layerUrl:
			'https://services8.arcgis.com/lYI034SQcOoxRCR7/arcgis/rest/services/Occurrence/FeatureServer/0',
		fieldMap: {
			id: 'OBJECTID',
			category: 'occ_type',
			date: 'occ_date',
			municipality: 'municipality',
			clearance: 'case_status' // Open / Closed / Solved → normalized via clearanceMap
		},
		// No public address/description on this layer.
		clearanceMap: { Solved: 'Solved', Open: 'Ongoing', Closed: 'Unsolved' },
		center: [-79.42, 44.1],
		zoom: 9,
		bounds: [-79.8, 43.78, -78.95, 44.55],
		categories: [
			'Assaults',
			'Break and Enter - Residential',
			'Break and Enter - Commercial',
			'Robbery',
			'Theft of Motor Vehicle',
			'Theft Over $5000',
			'Theft Under $5000',
			'Fraud',
			'Drug Violations',
			'Mischief',
			'Homicide'
		],
		// Exact field values (Title Case) so the WHERE `IN (...)` clause matches.
		municipalities: [
			'Markham',
			'Vaughan',
			'Richmond Hill',
			'Newmarket',
			'Aurora',
			'Whitchurch-Stouffville',
			'East Gwillimbury',
			'Georgina',
			'King'
		],
		// York Region open data "Boundary" MapServer; layer 1 = local municipalities (NAME).
		boundary: {
			url: 'https://ww8.yorkmaps.ca/arcgis/rest/services/OpenData/Boundary/MapServer/1',
			nameField: 'NAME'
		},
		verified: true
	},
	{
		id: 'durham',
		label: 'Durham Region (Oshawa / Whitby / Ajax / Pickering)',
		// Durham Regional Police publish one FeatureServer per crime type (no unified
		// occurrence layer). `subLayers` queries each and stamps its category. Date is
		// split across occurrence_year/_month/_day, so filtering is year-coarse on the
		// server then refined client-side. layerUrl is a placeholder (unused here).
		layerUrl:
			'https://services6.arcgis.com/2r8RrIqBhHAeyu7x/arcgis/rest/services/Assault_Open_Data/FeatureServer/0',
		subLayers: [
			{ url: 'https://services6.arcgis.com/2r8RrIqBhHAeyu7x/arcgis/rest/services/Assault_Open_Data/FeatureServer/0', category: 'Assault' },
			{ url: 'https://services6.arcgis.com/2r8RrIqBhHAeyu7x/arcgis/rest/services/BnE_Open_Data/FeatureServer/0', category: 'Break and Enter' },
			{ url: 'https://services6.arcgis.com/2r8RrIqBhHAeyu7x/arcgis/rest/services/Robbery_Open_Data/FeatureServer/0', category: 'Robbery' },
			{ url: 'https://services6.arcgis.com/2r8RrIqBhHAeyu7x/arcgis/rest/services/Auto_Theft_Open_Data/FeatureServer/0', category: 'Auto Theft' },
			{ url: 'https://services6.arcgis.com/2r8RrIqBhHAeyu7x/arcgis/rest/services/Theft_Over_5000_Open_Data/FeatureServer/0', category: 'Theft Over' },
			{ url: 'https://services6.arcgis.com/2r8RrIqBhHAeyu7x/arcgis/rest/services/Drug_Violations_Open_Data/FeatureServer/0', category: 'Drug Violations' },
			{ url: 'https://services6.arcgis.com/2r8RrIqBhHAeyu7x/arcgis/rest/services/Firearm_Shooting_Open_Data/FeatureServer/0', category: 'Firearm Shooting' }
		],
		fieldMap: {
			id: 'event_unique_id',
			category: 'offence', // unused for filtering (category is per-layer); kept for clarity
			date: 'occurrence_year', // year field, used by the coarse server-side WHERE
			dateParts: { year: 'occurrence_year', month: 'occurrence_month', day: 'occurrence_day' },
			monthFormat: 'abbr', // "Jan", "Feb", ...
			municipality: 'municipality',
			description: 'offence',
			address: 'neighbourhood'
		},
		center: [-78.9, 44.0],
		zoom: 9,
		bounds: [-79.3, 43.75, -78.5, 44.55],
		categories: [
			'Assault',
			'Break and Enter',
			'Robbery',
			'Auto Theft',
			'Theft Over',
			'Drug Violations',
			'Firearm Shooting'
		],
		// Trimmed 3-letter codes (raw values are space-padded); matched client-side.
		municipalities: ['OSH', 'WHI', 'AJA', 'PIC', 'CLA', 'UXB', 'BRO', 'SCU'],
		// Durham open data MapServer; layer 1 = municipal boundaries (NAME = Ajax, Whitby, ...).
		boundary: {
			url: 'https://maps.durham.ca/arcgis/rest/services/Open_Data/Durham_OpenData/MapServer/1',
			nameField: 'NAME'
		},
		verified: true
	},
	{
		id: 'halton',
		label: 'Halton Region (Oakville / Burlington / Milton / Halton Hills)',
		// Halton Regional Police crime map layer (single point layer). Category is the
		// free-text DESCRIPTION; we curate the crime-relevant subset below.
		layerUrl:
			'https://services2.arcgis.com/o1LYr96CpFkfsDJS/arcgis/rest/services/Crime_Map/FeatureServer/0',
		// DESCRIPTION/CITY are padded with a leading space — match them client-side.
		clientFilter: true,
		fieldMap: {
			id: 'OBJECTID',
			category: 'DESCRIPTION',
			date: 'DATE',
			municipality: 'CITY',
			description: 'DESCRIPTION',
			address: 'LOCATION'
		},
		center: [-79.85, 43.5],
		zoom: 9.5,
		bounds: [-80.25, 43.3, -79.6, 43.78],
		categories: [
			'BREAK AND ENTER HOUSE',
			'BREAK AND ENTER SHOP',
			'BREAK AND ENTER OTHER',
			'THEFT OF VEHICLE',
			'THEFT FROM AUTO',
			'THEFT UNDER',
			'THEFT OVER',
			'THEFT OF BICYCLE',
			'ROBBERY',
			'ARSON',
			'OFFENSIVE WEAPONS',
			'FEDERAL STATS - DRUGS',
			'PROPERTY DAMAGE UNDER $5,000',
			'PROPERTY DAMAGE OVER $5,000'
		],
		municipalities: ['OAKVILLE', 'BURLINGTON', 'MILTON', 'HALTON HILLS', 'GEORGETOWN', 'ACTON'],
		// Georgetown and Acton are communities within the Town of Halton Hills.
		municipalityGroups: [{ code: 'HALTON HILLS', children: ['GEORGETOWN', 'ACTON'] }],
		// No Halton-hosted boundary layer exists; use Ontario's authoritative lower/single-tier
		// layer (CORS-enabled). Drop water-extent polygons so outlines don't bleed into the lake.
		// Note: Georgetown/Acton are communities within Halton Hills, so they have no outline.
		boundary: {
			url: 'https://services.arcgis.com/6iGx1Dq91oKtcE7x/arcgis/rest/services/Munic_Bnd_Lower_And_Single/FeatureServer/6',
			nameField: 'MUNICIPAL_NAME_SHORTFORM',
			where: "MUNICIPAL_AREA_EXTENT_TYPE <> 'Water'"
		},
		verified: true
	}
];

export const DEFAULT_REGION = REGIONS[0];
