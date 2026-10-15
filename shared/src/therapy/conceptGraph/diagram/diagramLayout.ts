// Раскладка диаграммы концептуализации: чистая функция от модели графа и ширины.
// Зоны сверху вниз повторяют карту режимов: опора, корни, схемы, за кулисами
// (дети и критики), на сцене копинги, внизу цена. Пустая зона не рисуется,
// кроме четырёх зон режимов, где пустота — часть картины.
import type { ConceptGraphModel } from '../conceptGraphTypes';
import { LANE_META } from '../modeLanes';
import { buildEdges } from './diagramEdges';
import { modeCenters } from './diagramLinks';
import { backstageZone } from './diagramBackstage';
import {
  copingZone,
  costZone,
  healthyZone,
  rootsZone,
  schemasZone,
} from './diagramZones';
import type { ZoneOut } from './diagramZoneKit';
import {
  SPACE,
  type DiagramBand,
  type DiagramBandId,
  type DiagramLayout,
  type DiagramNode,
} from './diagramTypes';

/** Уже этого раскладка не сужается: фигуры не должны вылезать за поля. */
const MIN_WIDTH = 240;

const BAND_META: Record<
  DiagramBandId,
  { title: string; subtitle: string; color: string }
> = {
  healthy: {
    title: LANE_META.healthy.title,
    subtitle: LANE_META.healthy.subtitle,
    color: 'var(--accent-green)',
  },
  roots: {
    title: 'Корни',
    subtitle: 'Ранний опыт и потребности, которые не встретили ответа',
    color: 'var(--accent-yellow)',
  },
  schemas: {
    title: 'Схемы',
    subtitle: 'Сформировались в детстве и включаются сейчас',
    color: 'var(--accent-indigo)',
  },
  backstage: {
    title: 'За кулисами',
    subtitle: 'Детские режимы и критик: то, что не видно снаружи',
    color: 'var(--accent-blue)',
  },
  coping: {
    title: LANE_META.coping.title,
    subtitle: LANE_META.coping.subtitle,
    color: 'var(--accent-orange)',
  },
  cost: {
    title: 'Цена',
    subtitle: 'Проблемы сейчас',
    color: 'var(--accent-red)',
  },
};

export function layoutConceptDiagram(
  graph: ConceptGraphModel,
  width: number,
): DiagramLayout {
  const W = Math.max(width, MIN_WIDTH);
  const avail = W - 2 * SPACE.pad;

  // Режимы раскладываются первыми: от их x зависит порядок схем и потребностей.
  const healthy = healthyZone(graph, avail);
  const backstage = backstageZone(graph, avail);
  const coping = copingZone(graph, avail);
  const cx = modeCenters([
    ...healthy.nodes,
    ...backstage.nodes,
    ...coping.nodes,
  ]);

  const zones: [DiagramBandId, ZoneOut | null][] = [
    ['healthy', healthy],
    ['roots', rootsZone(graph, avail, cx)],
    ['schemas', schemasZone(graph, avail, cx)],
    ['backstage', backstage],
    ['coping', coping],
    ['cost', costZone(graph, avail)],
  ];

  const bands: DiagramBand[] = [];
  const nodes: DiagramNode[] = [];
  let y = 0;
  for (const [id, zone] of zones) {
    if (!zone) continue;
    const h = SPACE.header + zone.h + SPACE.bottom;
    bands.push({ id, ...BAND_META[id], y, h });
    for (const n of zone.nodes) nodes.push({ ...n, y: n.y + y + SPACE.header });
    y += h + SPACE.zoneGap;
  }
  const height = y - SPACE.zoneGap;
  return {
    width: W,
    height,
    bands,
    nodes,
    edges: buildEdges(graph, nodes, bands, W),
  };
}
