// Узкая раскладка (контейнер уже WIDE_MIN): то же самое сверху вниз — режимы,
// схемы (каждая с овалом опыта над ней), круг потребностей, здоровые режимы.
// Фигуры стоят одной колонкой посередине, а по бокам остаются дорожки: линии
// между секциями идут по ним, не под фигурами (diagramLanes.ts).
// Горизонтального скролла нет.
import type { ConceptGraphModel } from '../conceptGraphTypes';
import {
  ORIGIN_W,
  healthyNodes,
  modeNodes,
  placeGroup,
  schemaGroups,
  schemaPlaceholder,
  stack,
} from './diagramColumns';
import { circleGeometry, type CircleGeometry } from './diagramCircle';
import { orderColumns } from './diagramOrder';
import { HEAD_H, section } from './diagramSections';
import type { DiagramNode, DiagramSection } from './diagramTypes';

/** Дорожки линий с каждой стороны: фигуры стоят правее и левее этой полосы. */
export const LANE_ZONE = 34;
const MAX_W = 420;
const D_MAX = 320;
const ITEM_GAP = 14;
const GROUP_GAP = 22;
const SECTION_GAP = 30;

/** Колонка фигур узкого вида: по центру, не шире MAX_W, по бокам — дорожки. */
export function narrowColumn(width: number): { x: number; w: number } {
  const w = Math.min(width - 2 * LANE_ZONE, MAX_W);
  return { x: (width - w) / 2, w };
}

export interface NarrowLayout {
  height: number;
  nodes: DiagramNode[];
  sections: DiagramSection[];
  geometry: CircleGeometry;
}

export function layoutNarrow(
  graph: ConceptGraphModel,
  width: number,
): NarrowLayout {
  const { x, w: sw } = narrowColumn(width);
  const ordered = orderColumns(graph);
  const nodes: DiagramNode[] = [];
  const sections: DiagramSection[] = [];
  let y = 0;

  const put = (col: { nodes: DiagramNode[]; h: number }) => {
    nodes.push(...col.nodes.map((n) => ({ ...n, x: x + n.x, y: y + n.y })));
    y += col.h;
  };

  sections.push(section('modes', x, y, sw));
  y += HEAD_H;
  put(stack(modeNodes(ordered, sw), () => ITEM_GAP));
  y += SECTION_GAP;

  sections.push(section('schemas', x, y, sw));
  y += HEAD_H;
  const groups = schemaGroups(ordered.schemas, sw, Math.round(sw * ORIGIN_W));
  if (groups.length === 0) {
    put(stack([schemaPlaceholder(sw)], () => 0));
  } else {
    let gy = 0;
    const placed: DiagramNode[] = [];
    groups.forEach((g, i) => {
      if (i > 0) gy += GROUP_GAP;
      placed.push(...placeGroup(g, 0, gy));
      gy += g.h;
    });
    put({ nodes: placed, h: gy });
  }
  y += SECTION_GAP;

  const d = Math.min(width - 32, D_MAX);
  const geometry = circleGeometry(d, { x: width / 2, y: y + d / 2 });
  nodes.push(...geometry.needs);
  y += d + SECTION_GAP;

  sections.push(section('healthy', x, y, sw));
  y += HEAD_H;
  put(stack(healthyNodes(graph, sw), () => ITEM_GAP));
  return { height: y + 8, nodes, sections, geometry };
}
