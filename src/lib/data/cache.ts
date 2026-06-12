import type { CrimeCollection } from './types';

// Two-tier cache: in-memory (fast, per-session) + localStorage (survives reload),
// keyed by region+filter signature. Keeps re-toggling filters from re-hitting ArcGIS.

const TTL_MS = 30 * 60 * 1000; // 30 minutes
// v2: features gained `clearance`; bump invalidates cached pre-clearance shapes.
const PREFIX = 'ccm:cache:v2:';
const mem = new Map<string, { at: number; data: CrimeCollection }>();

// Drop entries from older cache versions — they are never read again.
try {
	for (let i = localStorage.length - 1; i >= 0; i--) {
		const k = localStorage.key(i);
		if (k?.startsWith('ccm:cache:') && !k.startsWith(PREFIX)) localStorage.removeItem(k);
	}
} catch {
	// localStorage unavailable (SSR/privacy mode) — nothing to clean.
}

export function cacheGet(key: string): CrimeCollection | null {
	const hit = mem.get(key);
	if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

	try {
		const raw = localStorage.getItem(PREFIX + key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { at: number; data: CrimeCollection };
		if (Date.now() - parsed.at >= TTL_MS) {
			localStorage.removeItem(PREFIX + key);
			return null;
		}
		mem.set(key, parsed);
		return parsed.data;
	} catch {
		return null;
	}
}

export function cacheSet(key: string, data: CrimeCollection): void {
	const entry = { at: Date.now(), data };
	mem.set(key, entry);
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(entry));
	} catch {
		// Quota exceeded or unavailable — memory cache still works.
	}
}
