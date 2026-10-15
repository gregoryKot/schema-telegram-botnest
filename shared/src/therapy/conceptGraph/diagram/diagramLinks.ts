import type { ConceptGraphModel } from '../conceptGraphTypes';
import type { DiagramNode } from './diagramTypes';

/** Какие режимы питает схема и на каких режимах держится потребность. */
export function linkIndex(graph: ConceptGraphModel): {
  schemas: Map<string, string[]>;
  needs: Map<string, string[]>;
} {
  const schemas = new Map<string, string[]>();
  const needs = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, key: string, modeId: string) =>
    m.set(key, [...(m.get(key) ?? []), modeId]);
  for (const card of Object.values(graph.lanes).flat()) {
    for (const s of card.schemas) add(schemas, s.id, card.modeId);
    for (const n of card.needs) add(needs, n.id, card.modeId);
  }
  return { schemas, needs };
}

/**
 * Порядок, уменьшающий пересечения линий: фигура стоит там, где в среднем
 * стоят режимы, к которым от неё идут линии. Без линий — в конец, в исходном
 * порядке (домены схем, NEED_ORDER).
 */
export function byBarycenter<T>(
  items: T[],
  idOf: (item: T) => string,
  links: Map<string, string[]>,
  modeCx: Map<string, number>,
): T[] {
  const bary = (item: T): number => {
    const xs = (links.get(idOf(item)) ?? [])
      .map((m) => modeCx.get(m))
      .filter((x): x is number => x !== undefined);
    return xs.length === 0
      ? Infinity
      : xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  return items
    .map((item, i) => ({ item, i, b: bary(item) }))
    .sort((a, b) => (a.b === b.b ? a.i - b.i : a.b - b.b))
    .map((e) => e.item);
}

/** Центры режимов по x: из них считаются барицентры. */
export function modeCenters(nodes: DiagramNode[]): Map<string, number> {
  return new Map(
    nodes
      .filter((n) => n.modeId)
      .map((n) => [n.modeId as string, n.x + n.w / 2] as const),
  );
}
