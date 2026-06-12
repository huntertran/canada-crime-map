import type {
	ClearanceCounts,
	CrimeCollection,
	CrimeFeature,
	Filters,
	RegionConfig
} from './types';
import { cacheGet, cacheSet } from './cache';
import { generateDemo, filterDemo } from './demo';

const PAGE_SIZE = 2000; // ArcGIS hosted layers cap maxRecordCount at 2000.

/** ArcGIS SQL string literal escape. */
function esc(v: string): string {
	return v.replace(/'/g, "''");
}

/** Build the WHERE clause from filters using the region's real field names. */
export function buildWhere(region: RegionConfig, filters: Filters): string {
	const fm = region.fieldMap;
	const parts: string[] = [
		`${fm.date} >= timestamp '${filters.from} 00:00:00'`,
		`${fm.date} <= timestamp '${filters.to} 23:59:59'`
	];
	if (filters.categories.length) {
		const list = filters.categories.map((c) => `'${esc(c)}'`).join(', ');
		parts.push(`${fm.category} IN (${list})`);
	}
	if (filters.municipalities.length && fm.municipality) {
		const list = filters.municipalities.map((m) => `'${esc(m)}'`).join(', ');
		parts.push(`${fm.municipality} IN (${list})`);
	}
	return parts.join(' AND ');
}

function outFields(region: RegionConfig): string {
	const fm = region.fieldMap;
	const fields = [
		fm.id,
		fm.category,
		fm.date,
		fm.municipality,
		fm.description,
		fm.address,
		fm.clearance
	].filter(Boolean) as string[];
	return [...new Set(fields)].join(',');
}

function toIso(v: unknown): string {
	if (typeof v === 'number') return new Date(v).toISOString(); // epoch ms
	if (typeof v === 'string') {
		const d = new Date(v);
		return isNaN(d.getTime()) ? v : d.toISOString();
	}
	return '';
}

/** Map one raw ArcGIS GeoJSON feature onto our normalized CrimeFeature. */
function mapFeature(raw: any, region: RegionConfig): CrimeFeature | null {
	const fm = region.fieldMap;
	const p = raw?.properties ?? {};
	const coords = raw?.geometry?.coordinates;
	if (!coords || coords.length < 2) return null;
	return {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
		properties: {
			id: p[fm.id] ?? raw.id ?? '',
			category: String(p[fm.category] ?? 'Other'),
			date: toIso(p[fm.date]),
			municipality: fm.municipality ? p[fm.municipality] : undefined,
			description: fm.description ? p[fm.description] : undefined,
			address: fm.address ? p[fm.address] : undefined,
			clearance: fm.clearance ? p[fm.clearance] : undefined
		}
	};
}

/** Query the ArcGIS FeatureServer layer, paginating until exhausted. */
async function queryArcgis(
	region: RegionConfig,
	filters: Filters,
	signal?: AbortSignal
): Promise<CrimeCollection> {
	const where = buildWhere(region, filters);
	const features: CrimeFeature[] = [];
	let offset = 0;

	for (;;) {
		const url = new URL(region.layerUrl.replace(/\/$/, '') + '/query');
		url.search = new URLSearchParams({
			where,
			outFields: outFields(region),
			outSR: '4326',
			resultOffset: String(offset),
			resultRecordCount: String(PAGE_SIZE),
			f: 'geojson'
		}).toString();

		const res = await fetch(url, { signal });
		if (!res.ok) throw new Error(`ArcGIS ${res.status} ${res.statusText}`);
		const json = await res.json();
		if (json.error) throw new Error(`ArcGIS error: ${json.error.message ?? 'unknown'}`);

		const page: any[] = json.features ?? [];
		for (const raw of page) {
			const f = mapFeature(raw, region);
			if (f) features.push(f);
		}

		if (page.length < PAGE_SIZE) break;
		offset += PAGE_SIZE;
		if (offset > 200000) break; // safety valve
	}

	return { type: 'FeatureCollection', features };
}

// Per-region latest available date (YYYY-MM-DD), so the UI can anchor its window
// to data that actually exists (Toronto's MCI lags ~2 months behind today).
const maxDateCache = new Map<string, string | null>();

export async function fetchDataMaxDate(
	region: RegionConfig,
	signal?: AbortSignal
): Promise<string | null> {
	if (!region.verified) return null;
	if (maxDateCache.has(region.id)) return maxDateCache.get(region.id)!;

	const url = new URL(region.layerUrl.replace(/\/$/, '') + '/query');
	url.search = new URLSearchParams({
		where: '1=1',
		outStatistics: JSON.stringify([
			{ statisticType: 'max', onStatisticField: region.fieldMap.date, outStatisticFieldName: 'mx' }
		]),
		f: 'json'
	}).toString();

	let iso: string | null = null;
	try {
		const res = await fetch(url, { signal });
		if (res.ok) {
			const json = await res.json();
			const mx = json?.features?.[0]?.attributes?.mx;
			if (typeof mx === 'number') iso = new Date(mx).toISOString().slice(0, 10);
			else if (typeof mx === 'string' && mx) iso = mx.slice(0, 10);
		}
	} catch {
		iso = null;
	}
	maxDateCache.set(region.id, iso);
	return iso;
}

/**
 * Per-category solved/ongoing/unsolved tallies via a server-side groupBy query.
 * Deliberately ignores the category filter so every checkbox row keeps its
 * numbers even when unchecked. Unrecognized statuses count as unsolved.
 * Returns null for regions without a clearance field.
 */
export async function fetchClearanceCounts(
	region: RegionConfig,
	filters: Filters,
	signal?: AbortSignal
): Promise<ClearanceCounts | null> {
	const fm = region.fieldMap;
	if (!fm.clearance || !region.verified) return null;

	const where = buildWhere(region, { ...filters, categories: [] });
	const url = new URL(region.layerUrl.replace(/\/$/, '') + '/query');
	url.search = new URLSearchParams({
		where,
		groupByFieldsForStatistics: `${fm.category},${fm.clearance}`,
		outStatistics: JSON.stringify([
			{ statisticType: 'count', onStatisticField: fm.id, outStatisticFieldName: 'n' }
		]),
		f: 'json'
	}).toString();

	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(`ArcGIS ${res.status} ${res.statusText}`);
	const json = await res.json();
	if (json.error) throw new Error(`ArcGIS error: ${json.error.message ?? 'unknown'}`);

	const counts: ClearanceCounts = {};
	for (const f of json.features ?? []) {
		const a = f.attributes ?? {};
		const cat = String(a[fm.category] ?? '');
		if (!cat) continue;
		const row = (counts[cat] ??= { solved: 0, ongoing: 0, unsolved: 0 });
		if (a[fm.clearance] === 'Solved') row.solved += a.n ?? 0;
		else if (a[fm.clearance] === 'Ongoing') row.ongoing += a.n ?? 0;
		else row.unsolved += a.n ?? 0;
	}
	return counts;
}

export interface LoadResult {
	data: CrimeCollection;
	source: 'live' | 'cache' | 'demo';
	error?: string;
}

function cacheKey(region: RegionConfig, filters: Filters): string {
	return `${region.id}|${buildWhere(region, filters)}`;
}

/**
 * Top-level loader: cache → live ArcGIS (if verified) → demo fallback.
 * Always resolves with usable data so the UI never hard-fails.
 */
export async function loadIncidents(
	region: RegionConfig,
	filters: Filters,
	signal?: AbortSignal
): Promise<LoadResult> {
	const key = cacheKey(region, filters);
	const cached = cacheGet(key);
	if (cached) return { data: cached, source: 'cache' };

	if (region.verified) {
		try {
			const data = await queryArcgis(region, filters, signal);
			cacheSet(key, data);
			return { data, source: 'live' };
		} catch (e) {
			// An aborted request (filters/region changed mid-flight) is not a failure —
			// rethrow so the caller drops it instead of showing demo data.
			if (e instanceof DOMException && e.name === 'AbortError') throw e;
			const msg = e instanceof Error ? e.message : String(e);
			return { data: filterDemo(generateDemo(region), filters), source: 'demo', error: msg };
		}
	}

	// Unverified endpoint: use demo data, filtered client-side.
	return {
		data: filterDemo(generateDemo(region), filters),
		source: 'demo',
		error: 'Region endpoint not yet configured (verified:false) — showing demo data.'
	};
}
