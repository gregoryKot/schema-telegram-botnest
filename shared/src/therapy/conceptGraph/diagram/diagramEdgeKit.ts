// Помощники стрелок между кластерами: выбор ближайшей фигуры ряда и сама
// стрелка с подписью.
import { bezierAt, chainMid } from './diagramCurves';
import type {
  DiagramEdge,
  DiagramEdgeKind,
  DiagramNode,
  Pt,
} from './diagramTypes';

export const cx = (n: DiagramNode) => n.x + n.w / 2;
export const cy = (n: DiagramNode) => n.y + n.h / 2;
export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function nearest(ns: DiagramNode[], x: number): DiagramNode {
  return ns.reduce((best, n) =>
    Math.abs(cx(n) - x) < Math.abs(cx(best) - x) ? n : best,
  );
}
export const topRow = (ns: DiagramNode[]) => {
  const top = Math.min(...ns.map((n) => n.y));
  return ns.filter((n) => n.y <= top + 1);
};
export const bottomRow = (ns: DiagramNode[]) => {
  const bottom = Math.max(...ns.map((n) => n.y + n.h));
  return ns.filter((n) => n.y + n.h >= bottom - 1);
};

/** Точка кривой на высоте y (первое пересечение); нет пересечения — середина. */
function pointAtY(points: Pt[], y: number): Pt {
  for (let i = 0; i + 3 < points.length; i += 3) {
    const seg = points.slice(i, i + 4);
    for (let k = 0; k < 40; k++) {
      const a = bezierAt(seg, k / 40);
      const b = bezierAt(seg, (k + 1) / 40);
      if ((a.y - y) * (b.y - y) <= 0) return b;
    }
  }
  return chainMid(points);
}

export function edge(
  kind: DiagramEdgeKind,
  from: DiagramNode,
  to: DiagramNode,
  points: Pt[],
  color: string,
  label?: string,
  labelY?: number,
): DiagramEdge {
  return {
    id: `${kind}:${from.id}>${to.id}`,
    from: from.id,
    to: to.id,
    kind,
    points,
    color,
    opacity: 0.8,
    label,
    labelAt: label
      ? labelY === undefined
        ? chainMid(points)
        : pointAtY(points, labelY)
      : undefined,
  };
}
