// Общие части обеих раскладок: стопка фигур по вертикали и фигуры секций с
// заготовкой на пустое место.
import type { GraphSchemaCard } from '../conceptGraphTypes';
import {
  modeNode,
  originNode,
  placeholderNode,
  schemaNode,
} from './diagramNodes';
import type { Ordered } from './diagramOrder';
import type { ConceptGraphModel } from '../conceptGraphTypes';
import type { DiagramNode } from './diagramTypes';

/** Между овалом опыта и его схемой: здесь стоит стрелка овал → схема. */
export const ORIGIN_GAP = 28;
/** Овал опыта чуть уже схемы под ним. */
export const ORIGIN_W = 0.86;

/** Фигуры режимов (без здоровых) в порядке колонки; пусто — заготовка. */
export function modeNodes(ordered: Ordered, w: number): DiagramNode[] {
  const nodes = ordered.modes.map((c) => modeNode(c, c.lane, w));
  return nodes.length ? nodes : [placeholderNode('modes', w)];
}

export function healthyNodes(
  graph: ConceptGraphModel,
  w: number,
): DiagramNode[] {
  const nodes = graph.lanes.healthy.map((c) => modeNode(c, 'healthy', w));
  return nodes.length ? nodes : [placeholderNode('healthy', w)];
}

/** Схема с овалом опыта над ней (если опыт записан): одна группа колонки. */
export interface SchemaGroup {
  schema: DiagramNode;
  origin?: DiagramNode;
  w: number;
  h: number;
}

export function schemaGroups(
  schemas: GraphSchemaCard[],
  w: number,
  originW: number,
): SchemaGroup[] {
  return schemas.map((card) => {
    const schema = schemaNode(card, w);
    const origin = card.origin ? originNode(card, originW) : undefined;
    return {
      schema,
      origin,
      w,
      h: schema.h + (origin ? origin.h + ORIGIN_GAP : 0),
    };
  });
}

/** Ставит группу в точку (x, y): овал сверху по центру, схема под ним. */
export function placeGroup(
  g: SchemaGroup,
  x: number,
  y: number,
): DiagramNode[] {
  const oh = g.origin ? g.origin.h + ORIGIN_GAP : 0;
  const out: DiagramNode[] = [{ ...g.schema, x, y: y + oh }];
  if (g.origin) {
    out.unshift({ ...g.origin, x: x + (g.w - g.origin.w) / 2, y });
  }
  return out;
}

/** Пустая секция схем — заготовка вместо группы. */
export const schemaPlaceholder = (w: number): DiagramNode =>
  placeholderNode('schemas', w);

/** Фигуры стопкой по вертикали: возвращает высоту и ставит y. */
export function stack(
  nodes: DiagramNode[],
  gap: (prev: DiagramNode, next: DiagramNode) => number,
): { nodes: DiagramNode[]; h: number } {
  let y = 0;
  const placed = nodes.map((n, i) => {
    if (i > 0) y += gap(nodes[i - 1], n);
    const out = { ...n, y };
    y += n.h;
    return out;
  });
  return { nodes: placed, h: y };
}
