import type { Map as MlMap } from 'maplibre-gl';

/**
 * Per-category marker glyphs. Each entry is the *inner* SVG markup; `wrapSvg`
 * wraps it with sizing + a default white stroke so the glyph reads on the
 * colored incident dot. Codes match Peel's OccType (see regions.ts).
 */
// Named glyphs (inner SVG markup), shared across region category schemes.
const GLYPH = {
	bolt: '<path d="M13 2L5 13h5l-1 9 9-12h-6z" fill="#fff" stroke="none"/>',
	house: '<path d="M4 11l8-6 8 6"/><path d="M6 10v8h12v-8"/><path d="M10 18v-4h4v4"/>',
	capsule: '<rect x="4.5" y="9.5" width="15" height="5" rx="2.5"/><line x1="12" y1="9.5" x2="12" y2="14.5"/>',
	capsulePlus:
		'<rect x="4.5" y="9.5" width="11" height="5" rx="2.5"/><line x1="10" y1="9.5" x2="10" y2="14.5"/><line x1="18.5" y1="7" x2="18.5" y2="12"/><line x1="16" y1="9.5" x2="21" y2="9.5"/>',
	card: '<rect x="3" y="6" width="18" height="12" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="6.5" y1="14.5" x2="10.5" y2="14.5"/>',
	skull:
		'<path d="M6 11a6 6 0 0 1 12 0v2.5c0 1-.7 1.8-1.6 2v2.5H7.6V17.5C6.7 17.3 6 16.5 6 15.5z"/><circle cx="9.5" cy="11.5" r="1.5" fill="#fff" stroke="none"/><circle cx="14.5" cy="11.5" r="1.5" fill="#fff" stroke="none"/>',
	warning:
		'<path d="M12 4l9 15H3z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="16.6" r="0.5" fill="#fff" stroke="#fff"/>',
	bag: '<path d="M8.5 7h7l-1.3 2.2C16.5 10.5 18 13 18 15.5A3.5 3.5 0 0 1 14.5 19h-5A3.5 3.5 0 0 1 6 15.5c0-2.5 1.5-5 3.8-6.3z"/><path d="M12 11v5M10.5 12.3h3"/>',
	car: '<path d="M5.5 13l1.4-4.2A2 2 0 0 1 8.8 7.5h6.4a2 2 0 0 1 1.9 1.3L18.5 13"/><path d="M4 13h16v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5H7.5v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><circle cx="7.6" cy="14.8" r="1" fill="#fff" stroke="none"/><circle cx="16.4" cy="14.8" r="1" fill="#fff" stroke="none"/>',
	box: '<rect x="4" y="8" width="16" height="11" rx="1"/><path d="M4 8l8-4 8 4"/><line x1="12" y1="4" x2="12" y2="19"/>',
	dot: '<circle cx="12" cy="12" r="3.2" fill="#fff" stroke="none"/>'
};

/**
 * category code/value -> glyph. Peel uses 3-letter OccType codes; Toronto's
 * CSI_CATEGORY uses words. Both map onto the shared glyphs above.
 */
const ICONS: Record<string, string> = {
	// Peel (OccType codes)
	ASL: GLYPH.bolt,
	BNE: GLYPH.house,
	DRP: GLYPH.capsule,
	DRT: GLYPH.capsulePlus,
	FRA: GLYPH.card,
	HOM: GLYPH.skull,
	MIS: GLYPH.warning,
	ROB: GLYPH.bag,
	VEH: GLYPH.car,
	// Toronto (CSI_CATEGORY values)
	Assault: GLYPH.bolt,
	'Break and Enter': GLYPH.house,
	'Auto Theft': GLYPH.car,
	Robbery: GLYPH.bag,
	'Theft Over': GLYPH.box,
	// Fallback
	default: GLYPH.dot
};

export const ICON_PREFIX = 'crime-';
export const ICON_DEFAULT = ICON_PREFIX + 'default';

/** Wrap inner glyph markup as a standalone SVG document. */
export function wrapSvg(inner: string, stroke = '#fff', strokeWidth = 2.1): string {
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ` +
		`fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ` +
		`stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
	);
}

/** Inline SVG for a category (white glyph), for use in HTML legends via {@html}. */
export function iconSvg(code: string): string {
	return wrapSvg(ICONS[code] ?? ICONS.default);
}

/** Rasterize an SVG string to ImageData at `size`x`size` device pixels. */
async function rasterize(svg: string, size: number): Promise<ImageData> {
	const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	try {
		const img = new Image(size, size);
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = reject;
			img.src = url;
		});
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0, size, size);
		return ctx.getImageData(0, 0, size, size);
	} finally {
		URL.revokeObjectURL(url);
	}
}

/**
 * Register every category glyph as a map image (`crime-<code>`). Call once after
 * the style loads, before adding the symbol layer that references them.
 */
export async function loadCrimeIcons(map: MlMap, size = 56): Promise<void> {
	await Promise.all(
		Object.entries(ICONS).map(async ([code, inner]) => {
			const id = ICON_PREFIX + code;
			if (map.hasImage(id)) return;
			const data = await rasterize(wrapSvg(inner), size);
			map.addImage(id, data, { pixelRatio: 2 });
		})
	);
}
