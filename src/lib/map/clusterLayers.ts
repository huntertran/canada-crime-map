import type { Map as MlMap, ExpressionSpecification } from 'maplibre-gl';
import { CATEGORY_COLORS, DEFAULT_COLOR } from '../data/regions';

export const SRC = 'crimes';
export const LYR_CLUSTERS = 'crimes-clusters';
export const LYR_COUNT = 'crimes-cluster-count';
export const LYR_POINT = 'crimes-unclustered';

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
			'circle-radius': 7,
			'circle-stroke-width': 1.5,
			'circle-stroke-color': '#ffffff'
		}
	});
}
