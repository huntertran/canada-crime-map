import type { CrimeProps } from '../data/types';
import { colorFor, labelFor, muniLabel } from '../data/regions';

function esc(s: unknown): string {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function fmtDate(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return esc(iso);
	return d.toLocaleString('en-CA', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/** Compact HTML for the on-map MapLibre popup. The side panel renders richer detail. */
export function buildPopupHtml(p: CrimeProps): string {
	const rows: string[] = [];
	if (p.date) rows.push(`<div>📅 ${fmtDate(p.date)}</div>`);
	if (p.municipality) rows.push(`<div>📍 ${esc(muniLabel(p.municipality))}</div>`);
	if (p.address) rows.push(`<div>${esc(p.address)}</div>`);
	return `
		<div style="font:13px/1.4 system-ui,sans-serif;max-width:220px">
			<div style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:4px">
				<span style="width:10px;height:10px;border-radius:50%;background:${colorFor(
					p.category
				)};display:inline-block"></span>
				${esc(labelFor(p.category))}
			</div>
			${rows.join('')}
		</div>`;
}
