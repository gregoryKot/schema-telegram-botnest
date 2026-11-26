// Раздача портов: у фигуры линии одной стороны идут веером в порядке
// положения другого конца, чтобы они не пересекались у самой фигуры.
import { portPoint, spreadU, type Side } from './diagramPorts';
import type { DiagramNode, Pt } from './diagramTypes';

export interface End {
  node: DiagramNode;
  side: Side;
  /** Центр фигуры на другом конце линии: по нему упорядочивается веер. */
  other: Pt;
}

/** Порт каждого конца: линии одной стороны фигуры идут веером. */
export function assignPorts(ends: End[]): Pt[] {
  const groups = new Map<string, number[]>();
  ends.forEach((e, i) => {
    const key = `${e.node.id}:${e.side}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const out = new Array<Pt>(ends.length);
  for (const idx of groups.values()) {
    const { node, side } = ends[idx[0]];
    const vertical = side === 'top' || side === 'bottom';
    const sorted = [...idx].sort((a, b) =>
      vertical
        ? ends[a].other.x - ends[b].other.x
        : ends[a].other.y - ends[b].other.y,
    );
    sorted.forEach((i, k) => {
      out[i] = portPoint(
        node,
        side,
        spreadU(node.shape, side, k, sorted.length),
      );
    });
  }
  return out;
}
