// Точки, где линия касается фигуры. Прямоугольник и таблетка плоские сверху и
// снизу, эллипс и пятиугольник — нет: без поправки стрелка повисла бы в воздухе.
import type { DiagramNode, DiagramShape, Pt } from './diagramTypes';

export type Side = 'top' | 'bottom';

/** Насколько контур отступает от рамки фигуры в точке u (0..1 по ширине). */
function inset(shape: DiagramShape, side: Side, u: number, h: number): number {
  const off = Math.abs(2 * u - 1);
  switch (shape) {
    case 'ellipse':
      return (h / 2) * (1 - Math.sqrt(1 - off * off));
    case 'pentagon':
      // вершина сверху, плоское основание снизу (пути в modeShapes)
      return side === 'top' ? ((2 + 0.727 * 50 * off) / 100) * h : 0.076 * h;
    case 'shield':
      return 0.04 * h;
    case 'cloud':
      return side === 'top' ? 0.07 * h : 0.13 * h;
    case 'tag':
      return 0.02 * h;
    default:
      return 0;
  }
}

export function portPoint(node: DiagramNode, side: Side, u: number): Pt {
  const d = inset(node.shape, side, u, node.h);
  return {
    x: node.x + node.w * u,
    y: side === 'top' ? node.y + d : node.y + node.h - d,
  };
}

/** Где на стороне стоит i-я из n линий: веером вокруг центра. */
export function spreadU(
  shape: DiagramShape,
  side: Side,
  i: number,
  n: number,
): number {
  const [lo, hi] =
    shape === 'ellipse'
      ? [0.22, 0.78]
      : shape === 'pentagon' && side === 'top'
        ? [0.4, 0.6]
        : [0.3, 0.7];
  return n === 1 ? 0.5 : lo + ((hi - lo) * i) / (n - 1);
}
