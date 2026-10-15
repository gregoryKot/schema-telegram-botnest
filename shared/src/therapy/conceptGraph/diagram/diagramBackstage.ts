import type { ConceptGraphModel } from '../conceptGraphTypes';
import { flowRows, type FlowItem } from './diagramFlow';
import { textNode } from './diagramNodes';
import { SPACE } from './diagramTypes';
import { items, laneNodes, put, type ZoneOut } from './diagramZoneKit';

const { pad } = SPACE;

/**
 * «За кулисами»: слева дети (и триггер перед ними), справа критики, как у
 * Редигера. Рядом их ставит ширина; не хватает — критики сверху, дети снизу.
 */
export function backstageZone(
  graph: ConceptGraphModel,
  avail: number,
): ZoneOut {
  const kids = laneNodes(graph, 'child', avail);
  const critics = laneNodes(graph, 'critic', avail);
  const trigger = graph.trigger
    ? textNode(
        'trigger',
        'trigger',
        'Триггер',
        graph.trigger,
        'var(--text-sub)',
        avail,
      )
    : null;
  const left = trigger ? [trigger, ...kids] : kids;
  const leftItems: FlowItem[] = left.map((n, i) => ({
    w: n.w,
    h: n.h,
    gapBefore: trigger && i === 1 ? SPACE.triggerGap : undefined,
  }));
  const rightItems = items(critics);

  // Рядом кластеры встают, когда влезают: сначала с тремя фигурами в ряду у
  // левого (триггер и два ребёнка), потом по две.
  const rightCap = 2;
  for (const leftCap of trigger ? [3, 2] : [2]) {
    const lw = flowRows(leftItems, 0, Infinity, leftCap).w;
    const rw = flowRows(rightItems, 0, Infinity, rightCap).w;
    if (lw + SPACE.clusterGap + rw > avail) continue;
    const x0 = pad + (avail - (lw + SPACE.clusterGap + rw)) / 2;
    const L = flowRows(leftItems, x0, lw, leftCap);
    const R = flowRows(rightItems, x0 + lw + SPACE.clusterGap, rw, rightCap);
    const h = Math.max(L.h, R.h);
    return {
      nodes: [
        ...put(left, L, 0, (h - L.h) / 2),
        ...put(critics, R, 0, (h - R.h) / 2),
      ],
      h,
    };
  }
  const R = flowRows(rightItems, pad, avail);
  const L = flowRows(leftItems, pad, avail);
  const top = R.h + SPACE.clusterRowGap;
  return {
    nodes: [...put(left, L, 0, top), ...put(critics, R)],
    h: top + L.h,
  };
}
