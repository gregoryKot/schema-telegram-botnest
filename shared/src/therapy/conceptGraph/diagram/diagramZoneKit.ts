// Общие части зон диаграммы: результат зоны, укладка фигур рядами и фигуры
// клетки режимов.
import type { ConceptGraphModel } from '../conceptGraphTypes';
import type { ConceptLane } from '../modeLanes';
import {
  fitWidth,
  flowRows,
  type FlowItem,
  type FlowResult,
} from './diagramFlow';
import { modeNode, placeholderNode } from './diagramNodes';
import { SIZE, SPACE, type DiagramNode } from './diagramTypes';

export interface ZoneOut {
  nodes: DiagramNode[];
  h: number;
}

export const MIN_MODE_W = 148;
export const MIN_SCHEMA_W = 144;
const { pad } = SPACE;

export const items = (nodes: DiagramNode[]): FlowItem[] =>
  nodes.map((n) => ({ w: n.w, h: n.h }));

export function put(
  nodes: DiagramNode[],
  flow: FlowResult,
  dx = 0,
  dy = 0,
): DiagramNode[] {
  return nodes.map((n, i) => ({
    ...n,
    x: flow.placed[i].x + dx,
    y: flow.placed[i].y + dy,
  }));
}

/** Фигуры клетки; пусто — одна пунктирная заготовка («пустая клетка говорит»). */
export function laneNodes(
  graph: ConceptGraphModel,
  lane: ConceptLane,
  avail: number,
): DiagramNode[] {
  const w = fitWidth(SIZE.mode.w, MIN_MODE_W, avail);
  const cards = graph.lanes[lane];
  return cards.length === 0
    ? [placeholderNode(lane, w)]
    : cards.map((c) => modeNode(c, lane, w));
}

export function flowZone(nodes: DiagramNode[], avail: number): ZoneOut | null {
  if (nodes.length === 0) return null;
  const flow = flowRows(items(nodes), pad, avail);
  return { nodes: put(nodes, flow), h: flow.h };
}
