// Точки, где линия касается фигуры. Контур каждой фигуры — многоугольник в
// пикселях (outline); порт — пересечение прямой через долю u стороны с этим
// контуром. Так стрелка садится на настоящий край эллипса, пятиугольника и
// щита, а не повисает у рамки.
import type { DiagramNode, DiagramShape, Pt } from './diagramTypes';

export type Side = 'top' | 'bottom' | 'left' | 'right';

/** Контуры из карты режимов (modeShapes) в пространстве 0..100. */
const UNIT: Partial<Record<DiagramShape, [number, number][]>> = {
  octagon: [
    [29.3, 0],
    [70.7, 0],
    [100, 29.3],
    [100, 70.7],
    [70.7, 100],
    [29.3, 100],
    [0, 70.7],
    [0, 29.3],
  ],
  pentagon: [
    [50, 2],
    [97.6, 36.6],
    [79.4, 92.4],
    [20.6, 92.4],
    [2.4, 36.6],
  ],
};

const quad = (a: Pt, c: Pt, b: Pt, steps: number): Pt[] =>
  Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    };
  });

/** Щит: плоский верх и две квадратичные дуги к низу (SHIELD_PATH). */
function shieldUnit(): Pt[] {
  const p = (x: number, y: number): Pt => ({ x, y });
  return [
    p(4, 4),
    p(96, 4),
    p(96, 62),
    ...quad(p(96, 62), p(96, 78), p(50, 96), 8),
    ...quad(p(50, 96), p(4, 78), p(4, 62), 8),
  ];
}

const ARC = 48;

/** Контур фигуры в пикселях относительно её левого верхнего угла. */
export function outline(shape: DiagramShape, w: number, h: number): Pt[] {
  if (shape === 'ellipse') {
    return Array.from({ length: ARC }, (_, i) => {
      const a = (2 * Math.PI * i) / ARC;
      return {
        x: w / 2 + (w / 2) * Math.cos(a),
        y: h / 2 + (h / 2) * Math.sin(a),
      };
    });
  }
  if (shape === 'pill') {
    const r = Math.min(h / 2, w / 2);
    const cap = (cx: number, from: number) =>
      Array.from({ length: ARC / 2 + 1 }, (_, i) => {
        const a = from + (Math.PI * i) / (ARC / 2);
        return { x: cx + r * Math.cos(a), y: h / 2 + r * Math.sin(a) };
      });
    return [...cap(w - r, -Math.PI / 2), ...cap(r, Math.PI / 2)];
  }
  const unit: Pt[] =
    shape === 'shield'
      ? shieldUnit()
      : (
          UNIT[shape] ?? [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 100],
          ]
        ).map(([x, y]) => ({ x, y }));
  return unit.map((q) => ({ x: (q.x * w) / 100, y: (q.y * h) / 100 }));
}

/** Значения второй координаты, в которых прямая axis = v пересекает многоугольник. */
function crossings(poly: Pt[], axis: 'x' | 'y', v: number): number[] {
  const other = axis === 'x' ? 'y' : 'x';
  const out: number[] = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    if ((a[axis] - v) * (b[axis] - v) > 0 || a[axis] === b[axis]) return;
    const t = (v - a[axis]) / (b[axis] - a[axis]);
    out.push(a[other] + t * (b[other] - a[other]));
  });
  return out;
}

/**
 * Порт на стороне фигуры: u — доля стороны (по ширине для верха и низа, по
 * высоте для боков). Нет пересечения с контуром (край, срезанный углом) —
 * точка на рамке.
 */
export function portPoint(node: DiagramNode, side: Side, u: number): Pt {
  const poly = outline(node.shape, node.w, node.h);
  const vertical = side === 'top' || side === 'bottom';
  const along = vertical ? u * node.w : u * node.h;
  const hits = crossings(poly, vertical ? 'x' : 'y', along);
  const near = side === 'top' || side === 'left';
  const edge = vertical ? (near ? 0 : node.h) : near ? 0 : node.w;
  const d = hits.length ? (near ? Math.min(...hits) : Math.max(...hits)) : edge;
  return vertical
    ? { x: node.x + along, y: node.y + d }
    : { x: node.x + d, y: node.y + along };
}

/** Где на стороне стоит i-я из n линий: веером вокруг центра. */
export function spreadU(
  shape: DiagramShape,
  side: Side,
  i: number,
  n: number,
): number {
  const vertical = side === 'top' || side === 'bottom';
  const [lo, hi] =
    shape === 'ellipse'
      ? [0.24, 0.76]
      : shape === 'pentagon'
        ? vertical
          ? side === 'top'
            ? [0.4, 0.6]
            : [0.3, 0.7]
          : [0.3, 0.55]
        : [0.28, 0.72];
  return n === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * i) / (n - 1);
}
