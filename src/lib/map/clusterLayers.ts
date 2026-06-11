import type { Map as MlMap, ExpressionSpecification } from 'maplibre-gl';
import { CATEGORY_COLORS, DEFAULT_COLOR } from '../data/regions';
import { ICON_PREFIX, ICON_DEFAULT } from './icons';

export const SRC = 'crimes';
export const SRC_BOUNDARY = 'boundary';
export const LYR_BOUNDARY_FILL = 'boundary-fill';
export const LYR_BOUNDARY_LINE = 'boundary-line';
export const LYR_CLUSTERS = 'crimes-clusters';
export const LYR_COUNT = 'crimes-cluster-count';
export const LYR_POINT = 'crimes-unclustered';
export const LYR_ICON = 'crimes-icon';

// Heatmap uses its own UNclustered source — a clustered source only exposes cluster
// centroids + leaf points, which makes a misleading heatmap.
export const SRC_HEAT = 'crimes-heat';
export const LYR_HEAT = 'crimes-heatmap';

/** Layers shown in normal (non-heatmap) mode; hidden when the heatmap is on. */
export const CLUSTER_LAYERS = [LYR_CLUSTERS, LYR_COUNT, LYR_POINT, LYR_ICON];

/** match expression: category -> color, used for single-incident dots. */
function categoryColorExpr(): ExpressionSpecification {
	const pairs: string[] = [];
	for (const [cat, color] of Object.entries(CATEGORY_COLORS)) pairs.push(cat, color);
	const expr: unknown[] = ['match', ['get', 'category'], ...pairs, DEFAULT_COLOR];
	return expr as unknown as ExpressionSpecification;
}

/**
 * Add the supercluster three-layer stack to a map that already has source `SRC`
 * configured with cluster:true. Bigger/darker circles + larger numbers the more
 * incidents a cluster aggregates ("more dots combined" when zoomed out).
 */
/**
 * Selected-municipality outline: faint fill + solid border. Added before the
 * crime layers so incident markers draw on top.
 */
export function addBoundaryLayers(map: MlMap): void {
	map.addLayer({
		id: LYR_BOUNDARY_FILL,
		type: 'fill',
		source: SRC_BOUNDARY,
		paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.07 }
	});
	map.addLayer({
		id: LYR_BOUNDARY_LINE,
		type: 'line',
		source: SRC_BOUNDARY,
		paint: { 'line-color': '#2563eb', 'line-width': 2.5, 'line-opacity': 0.85 }
	});
}

export function addCrimeLayers(map: MlMap): void {
	map.addLayer({
		id: LYR_CLUSTERS,
		type: 'circle',
		source: SRC,
		filter: ['has', 'point_count'],
		paint: {
			'circle-color': [
				'step',
				['get', 'point_count'],
				'#51bbd6',
				25,
				'#f1a340',
				100,
				'#e34a33',
				500,
				'#b30000'
			],
			'circle-radius': ['step', ['get', 'point_count'], 16, 25, 22, 100, 30, 500, 40],
			'circle-opacity': 0.85,
			'circle-stroke-width': 2,
			'circle-stroke-color': '#ffffff'
		}
	});

	map.addLayer({
		id: LYR_COUNT,
		type: 'symbol',
		source: SRC,
		filter: ['has', 'point_count'],
		layout: {
			'text-field': ['get', 'point_count_abbreviated'],
			'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
			'text-size': 13
		},
		paint: { 'text-color': '#ffffff' }
	});

	map.addLayer({
		id: LYR_POINT,
		type: 'circle',
		source: SRC,
		filter: ['!', ['has', 'point_count']],
		paint: {
			'circle-color': categoryColorExpr(),
			// Bigger dots so the glyph fits and they're easy to tap on touch screens.
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 11, 16, 18],
			'circle-stroke-width': 1.5,
			'circle-stroke-color': '#ffffff'
		}
	});
}

/**
 * Symbol layer drawing the per-category glyph on top of each incident dot.
 * `icon-image` resolves `crime-<category>`, falling back to the default glyph.
 * Requires `loadCrimeIcons(map)` to have registered the images first.
 */
export function addIconLayer(map: MlMap): void {
	map.addLayer({
		id: LYR_ICON,
		type: 'symbol',
		source: SRC,
		filter: ['!', ['has', 'point_count']],
		layout: {
			'icon-image': [
				'coalesce',
				['image', ['concat', ICON_PREFIX, ['get', 'category']]],
				['image', ICON_DEFAULT]
			],
			'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.75, 16, 1.15],
			'icon-allow-overlap': true,
			'icon-ignore-placement': true
		}
	});
}

/**
 * Add the heatmap layer over source `SRC_HEAT` (unclustered). Hidden by default;
 * CrimeMap toggles its visibility against the cluster layers.
 */
export function addHeatmapLayer(map: MlMap): void {
	map.addLayer({
		id: LYR_HEAT,
		type: 'heatmap',
		source: SRC_HEAT,
		layout: { visibility: 'none' },
		paint: {
			// Density ramp: transparent -> blue -> green -> yellow -> red.
			'heatmap-color': [
				'interpolate',
				['linear'],
				['heatmap-density'],
				0,
				'rgba(0,0,255,0)',
				0.2,
				'#2c7bb6',
				0.4,
				'#abd9e9',
				0.6,
				'#ffffbf',
				0.8,
				'#fdae61',
				1,
				'#d7191c'
			],
			// Grow point influence + intensity as you zoom in.
			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 12, 14, 28],
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 3],
			'heatmap-opacity': 0.85
		}
	});
}
