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
	fieldMap: FieldMap;
	center: [number, number]; // [lng, lat]
	zoom: number;
	/** [west, south, east, north] extent used to auto-select the region as the map pans. */
	bounds?: [number, number, number, number];
	categories: string[];
	municipalities: string[];
	/** Optional municipal-boundary layer; selecting a municipality outlines it on the map. */
	boundary?: { url: string; nameField: string };
	/** false => layerUrl is a placeholder / not yet confirmed; app falls back to demo data. */
	verified: boolean;
}

export interface Filters {
	from: string; // YYYY-MM-DD
	to: string; // YYYY-MM-DD
	categories: string[]; // empty = all
	municipalities: string[]; // empty = all
}
