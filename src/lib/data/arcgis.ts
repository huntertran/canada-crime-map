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
	const parts: string[] = [];

	if (fm.dateParts) {
		// Split-date source: filter coarsely by year on the server, refine the exact
		// day range client-side after fetching (see queryMultiLayer).
		parts.push(
			`${fm.dateParts.year} >= ${Number(filters.from.slice(0, 4))}`,
			`${fm.dateParts.year} <= ${Number(filters.to.slice(0, 4))}`
		);
	} else {
		parts.push(
			`${fm.date} >= timestamp '${filters.from} 00:00:00'`,
			`${fm.date} <= timestamp '${filters.to} 23:59:59'`
		);
	}

	// Category lives in a field only for single-layer regions; multi-layer sources
	// select whole layers instead. Default to the region's curated list so unlisted
	// occurrence types (traffic, etc.) don't leak onto the map in the "all" view.
	if (!region.subLayers && !region.clientFilter) {
		const cats = filters.categories.length ? filters.categories : region.categories;
		if (cats.length) {
			const list = cats.map((c) => `'${esc(c)}'`).join(', ');
			parts.push(`${fm.category} IN (${list})`);
		}
	}

	// Skip server-side municipality filtering for multi-layer / dirty-string sources:
	// their codes are space-padded (e.g. "AJA            " / " ROBBERY"), so they're
	// trimmed and matched client-side instead.
	if (filters.municipalities.length && fm.municipality && !region.subLayers && !region.clientFilter) {
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
		fm.clearance,
		fm.dateParts?.year,
		fm.dateParts?.month,
		fm.dateParts?.day
	].filter(Boolean) as string[];
	return [...new Set(fields)].join(',');
}

const MONTH_ABBR: Record<string, number> = {
	jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
	jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

/** Normalize a raw clearance value onto canonical Solved/Ongoing/Unsolved (or undefined). */
function normClearance(region: RegionConfig, raw: unknown): string | undefined {
	if (raw == null) return undefined;
	const s = String(raw).trim();
	if (!region.clearanceMap) return s; // source already canonical (e.g. Peel)
	return region.clearanceMap[s] ?? 'Unsolved';
}

/** Assemble an ISO date from a region's split year/month/day fields. */
function partsToIso(region: RegionConfig, p: Record<string, unknown>): string {
	const dp = region.fieldMap.dateParts!;
	const y = Number(p[dp.year]);
	const d = Number(p[dp.day]);
	const mRaw = p[dp.month];
	const m =
		region.fieldMap.monthFormat === 'abbr'
			? MONTH_ABBR[String(mRaw).slice(0, 3).toLowerCase()] ?? 0
			: Number(mRaw);
	if (!y || !m || !d) return '';
	return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

function toIso(v: unknown): string {
	if (typeof v === 'number') return new Date(v).toISOString(); // epoch ms
	if (typeof v === 'string') {
		const d = new Date(v);
		return isNaN(d.getTime()) ? v : d.toISOString();
	}
	return '';
}

/**
 * Map one raw ArcGIS GeoJSON feature onto our normalized CrimeFeature.
 * `categoryOverride` is supplied for multi-layer sources where the category is
 * implied by which layer the feature came from rather than stored in a field.
 */
function mapFeature(raw: any, region: RegionConfig, categoryOverride?: string): CrimeFeature | null {
	const fm = region.fieldMap;
	const p = raw?.properties ?? {};
	const coords = raw?.geometry?.coordinates;
	if (!coords || coords.length < 2) return null;
	const muni = fm.municipality ? p[fm.municipality] : undefined;
	return {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
		properties: {
			id: p[fm.id] ?? raw.id ?? '',
			category: categoryOverride ?? (p[fm.category] == null ? 'Other' : String(p[fm.category]).trim()),
			date: fm.dateParts ? partsToIso(region, p) : toIso(p[fm.date]),
			municipality: muni == null ? undefined : String(muni).trim(),
			description: fm.description ? p[fm.description] : undefined,
			address: fm.address ? p[fm.address] : undefined,
			clearance: fm.clearance ? normClearance(region, p[fm.clearance]) : undefined
		}
	};
}

/** Page through one FeatureServer layer, mapping each row onto a CrimeFeature. */
async function queryLayer(
	layerUrl: string,
	where: string,
	region: RegionConfig,
	categoryOverride: string | undefined,
	signal: AbortSignal | undefined,
	out: CrimeFeature[]
): Promise<void> {
	let offset = 0;
	for (;;) {
		const url = new URL(layerUrl.replace(/\/$/, '') + '/query');
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
			const f = mapFeature(raw, region, categoryOverride);
			if (f) out.push(f);
		}

		if (page.length < PAGE_SIZE) break;
		offset += PAGE_SIZE;
		if (offset > 200000) break; // safety valve
	}
}

/** Client-side category + municipality match against (trimmed) feature properties. */
function matchesSelection(f: CrimeFeature, region: RegionConfig, filters: Filters): boolean {
	const cats = filters.categories.length ? filters.categories : region.categories;
	if (cats.length && !cats.includes(f.properties.category)) return false;
	if (filters.municipalities.length) {
		const m = f.properties.municipality;
		if (!m || !filters.municipalities.includes(m)) return false;
	}
	return true;
}

/** Single-layer source: one query against region.layerUrl. */
async function queryArcgis(
	region: RegionConfig,
	filters: Filters,
	signal?: AbortSignal
): Promise<CrimeCollection> {
	const features: CrimeFeature[] = [];
	await queryLayer(region.layerUrl, buildWhere(region, filters), region, undefined, signal, features);
	// Dirty-string sources filter category/municipality here rather than in the WHERE.
	const out = region.clientFilter ? features.filter((f) => matchesSelection(f, region, filters)) : features;
	return { type: 'FeatureCollection', features: out };
}

/**
 * Multi-layer source (e.g. Durham): one layer per category. Queries only the layers
 * for the selected categories, stamps each layer's category, then refines the exact
 * day range and municipalities client-side (the server WHERE was year-only).
 */
async function queryMultiLayer(
	region: RegionConfig,
	filters: Filters,
	signal?: AbortSignal
): Promise<CrimeCollection> {
	const cats = filters.categories.length ? filters.categories : region.categories;
	const selected = region.subLayers!.filter((s) => cats.includes(s.category));
	const where = buildWhere(region, filters);
	const features: CrimeFeature[] = [];

	for (const sub of selected) {
		await queryLayer(sub.url, where, region, sub.category, signal, features);
	}

	const { from, to } = filters;
	return {
		type: 'FeatureCollection',
		features: features.filter((f) => {
			const d = f.properties.date.slice(0, 10);
			if (!d || d < from || d > to) return false; // server filtered by year only
			return matchesSelection(f, region, filters);
		})
	};
}

// Per-region latest available date (YYYY-MM-DD), so the UI can anchor its window
// to data that actually exists (Toronto's MCI lags ~2 months behind today).
const maxDateCache = new Map<string, string | null>();

export async function fetchDataMaxDate(
	region: RegionConfig,
	signal?: AbortSignal
): Promise<string | null> {
	if (!region.verified) return null;
	// Split-date sources have no single timestamp field to take a max over.
	if (region.fieldMap.dateParts) return null;
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
		const st = normClearance(region, a[fm.clearance]);
		if (st === 'Solved') row.solved += a.n ?? 0;
		else if (st === 'Ongoing') row.ongoing += a.n ?? 0;
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
	// Multi-layer regions omit category/municipality from buildWhere (handled client-side),
	// so include them explicitly to avoid collisions between different selections.
	const c = [...filters.categories].sort().join('.');
	const m = [...filters.municipalities].sort().join('.');
	return `${region.id}|${buildWhere(region, filters)}|c:${c}|m:${m}`;
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
			const data = region.subLayers
				? await queryMultiLayer(region, filters, signal)
				: await queryArcgis(region, filters, signal);
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
