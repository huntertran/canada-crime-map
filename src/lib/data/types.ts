// Core domain types. GeoJSON is hand-typed (Point only) to avoid an extra @types/geojson dep.

export interface PointGeometry {
	type: 'Point';
	coordinates: [number, number]; // [lng, lat]
}

/** Normalized incident properties used everywhere downstream (map, popup, panel). */
export interface CrimeProps {
	id: string | number;
	category: string;
	date: string; // ISO 8601
	municipality?: string;
	description?: string;
	address?: string;
	/** Raw clearance status, e.g. Peel's Solved / Unsolved / Ongoing. */
	clearance?: string;
}

export interface CrimeFeature {
	type: 'Feature';
	geometry: PointGeometry;
	properties: CrimeProps;
}

export interface CrimeCollection {
	type: 'FeatureCollection';
	features: CrimeFeature[];
}

/**
 * Maps a region's raw ArcGIS attribute names onto our normalized CrimeProps.
 * Adding a new region = supply its field names here, nothing else changes.
 */
export interface FieldMap {
	id: string;
	category: string;
	date: string;
	municipality?: string;
	description?: string;
	address?: string;
	clearance?: string;
	/**
	 * Some sources store the occurrence date split across separate columns instead
	 * of one timestamp (e.g. Durham: occurrence_year/_month/_day). When set, the
	 * loader filters server-side by year only, then refines the exact range client-side.
	 */
	dateParts?: { year: string; month: string; day: string };
	/** Format of the `dateParts.month` value: 'num' (1-12) or 'abbr' (Jan/Feb/...). */
	monthFormat?: 'num' | 'abbr';
}

/**
 * A region whose incidents are split across one FeatureServer layer per crime type
 * (e.g. Durham). Each entry pairs a layer URL with the category to stamp on its rows.
 */
export interface SubLayer {
	url: string;
	category: string;
}

/** Per-category clearance tallies (regions with a clearance field only). */
export type ClearanceCounts = Record<
	string,
	{ solved: number; ongoing: number; unsolved: number }
>;

export interface RegionConfig {
	id: string;
	label: string;
	/** ArcGIS FeatureServer layer endpoint, e.g. https://.../FeatureServer/0 */
	layerUrl: string;
	/**
	 * Multi-layer sources: one layer per category. When present, `layerUrl` is unused
	 * for incident queries and `category` comes from the matched SubLayer, not a field.
	 */
	subLayers?: SubLayer[];
	/**
	 * Normalizes a region's raw clearance/status values onto the canonical
	 * Solved / Ongoing / Unsolved buckets (e.g. York's Open→Ongoing, Closed→Unsolved).
	 * Omit when the source already uses the canonical words (e.g. Peel). Unmapped values
	 * fall back to Unsolved.
	 */
	clearanceMap?: Record<string, 'Solved' | 'Ongoing' | 'Unsolved'>;
	/**
	 * Set when the source's category/municipality strings are dirty (e.g. Halton pads
	 * DESCRIPTION with a leading space), so exact server-side `IN (...)` matching fails.
	 * The loader then fetches by date only and filters category + municipality
	 * client-side against trimmed values.
	 */
	clientFilter?: boolean;
	fieldMap: FieldMap;
	center: [number, number]; // [lng, lat]
	zoom: number;
	/** [west, south, east, north] extent used to auto-select the region as the map pans. */
	bounds?: [number, number, number, number];
	categories: string[];
	/** Flat list of all selectable municipality codes (includes any group children). */
	municipalities: string[];
	/**
	 * Optional nesting for the municipality filter: a parent code whose `children` are
	 * communities within it (e.g. Halton Hills → Georgetown, Acton). Purely a UI concern —
	 * checking the parent just selects the parent + child codes in the flat selection, so
	 * matching/boundary logic is unaffected. Children must also appear in `municipalities`.
	 */
	municipalityGroups?: { code: string; children: string[] }[];
	/**
	 * Optional municipal-boundary layer; selecting a municipality outlines it on the map.
	 * `where` is an extra always-applied clause (e.g. drop water-extent polygons).
	 */
	boundary?: { url: string; nameField: string; where?: string };
	/** false => layerUrl is a placeholder / not yet confirmed; app falls back to demo data. */
	verified: boolean;
}

export interface Filters {
	from: string; // YYYY-MM-DD
	to: string; // YYYY-MM-DD
	categories: string[]; // empty = all
	municipalities: string[]; // empty = all
}
