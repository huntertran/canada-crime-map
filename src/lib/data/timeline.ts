// Time-slider support: slice already-loaded incidents into a moving date window.
// Pure client-side — the playback never refetches, it re-slices `data` per frame.
import type { CrimeCollection, CrimeFeature } from './types';

export type StepSize = 'day' | 'week' | 'month';

export const STEP_SIZES: { id: StepSize; label: string }[] = [
	{ id: 'day', label: 'Day' },
	{ id: 'week', label: 'Week' },
	{ id: 'month', label: 'Month' }
];

export const SPEEDS = [1, 2, 4];

export const DAY = 86_400_000;

export interface TimelineState {
	open: boolean;
	playing: boolean;
	/** Index of the current window within the range (may exceed the range; clamp on read). */
	step: number;
	size: StepSize;
	/** Steps per second. */
	speed: number;
	/** Show everything from the range start up to the playhead instead of one window. */
	cumulative: boolean;
}

/** Incidents sorted by time, with parsed timestamps alongside for binary search. */
export interface Timeline {
	features: CrimeFeature[];
	times: number[];
}

/** Parse + sort once per data load so each frame is two binary searches. */
export function buildTimeline(data: CrimeCollection): Timeline {
	const rows: { f: CrimeFeature; t: number }[] = [];
	for (const f of data.features) {
		const t = Date.parse(f.properties.date);
		if (!Number.isNaN(t)) rows.push({ f, t });
	}
	rows.sort((a, b) => a.t - b.t);
	return { features: rows.map((r) => r.f), times: rows.map((r) => r.t) };
}

/** First index whose time is >= t. */
function lowerBound(times: number[], t: number): number {
	let lo = 0;
	let hi = times.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (times[mid] < t) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/** Incidents with start <= time < end. */
export function sliceWindow(tl: Timeline, start: number, end: number): CrimeCollection {
	return {
		type: 'FeatureCollection',
		features: tl.features.slice(lowerBound(tl.times, start), lowerBound(tl.times, end))
	};
}

/** The filter's inclusive `from`/`to` dates (YYYY-MM-DD) as a half-open UTC ms range. */
export function rangeOf(from: string, to: string): { origin: number; end: number } {
	return { origin: Date.parse(from), end: Date.parse(to) + DAY };
}

/** Start of window `i`. Months step by calendar month from the origin's day. */
export function stepStart(origin: number, size: StepSize, i: number): number {
	if (size === 'month') {
		const d = new Date(origin);
		return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, d.getUTCDate());
	}
	return origin + i * (size === 'week' ? 7 : 1) * DAY;
}

/** Number of windows needed to cover [origin, end). */
export function stepCount(origin: number, end: number, size: StepSize): number {
	if (!(end > origin)) return 1;
	let n = 1;
	while (stepStart(origin, size, n) < end) n++;
	return n;
}

/** Index of the window containing time t. */
export function stepIndexAt(origin: number, size: StepSize, t: number): number {
	let i = 0;
	while (stepStart(origin, size, i + 1) <= t) i++;
	return i;
}

/** One window of the range with its incident count; `partial` = cut short by the range end. */
export interface Bucket {
	start: number;
	end: number;
	count: number;
	partial: boolean;
}

/** Incident counts per window across [origin, end) — same windows the slider steps through. */
export function bucketCounts(tl: Timeline, origin: number, end: number, size: StepSize): Bucket[] {
	if (!(end > origin)) return [];
	const n = stepCount(origin, end, size);
	const out: Bucket[] = [];
	let lo = lowerBound(tl.times, origin);
	for (let i = 0; i < n; i++) {
		const full = stepStart(origin, size, i + 1);
		const e = Math.min(full, end);
		const hi = lowerBound(tl.times, e);
		out.push({ start: stepStart(origin, size, i), end: e, count: hi - lo, partial: e < full });
		lo = hi;
	}
	return out;
}

/** Window bounds are UTC midnights, so format in UTC to keep labels on the right day. */
export function fmtDay(t: number, year = true): string {
	if (Number.isNaN(t)) return '—';
	return new Date(t).toLocaleDateString('en-CA', {
		month: 'short',
		day: 'numeric',
		year: year ? 'numeric' : undefined,
		timeZone: 'UTC'
	});
}

/** "Jul 31 – Aug 6, 2026" for a half-open [start, end) window; one date for a single day. */
export function windowLabel(start: number, end: number): string {
	const last = end - DAY;
	if (last <= start) return fmtDay(start);
	return `${fmtDay(start, false)} – ${fmtDay(last)}`;
}
