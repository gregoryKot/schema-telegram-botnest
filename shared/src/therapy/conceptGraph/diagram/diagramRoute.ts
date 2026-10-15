// Прокладка линий между фигурами: плавная кривая Безье с вертикальными
// касательными; если она проходит сквозь чужую фигуру — линия идёт по свободным
// просветам между фигурами каждого ряда (канал), а между рядами плавно смещается.
import { isClear, smooth, type Rect } from './diagramCurves';
import type { Pt } from './diagramTypes';

export type { Rect };

const MARGIN = 3;
/** Расстояние между линиями, делящими один просвет. */
const LANE_STEP = 3;
const EDGE_PAD = 10;

/** Занятый участок канала: следующая линия в этом просвете встаёт рядом, а не поверх. */
export interface Lane {
  x: number;
  y0: number;
  y1: number;
}

/** Ряды фигур между точками по вертикали: перекрывающиеся по y сливаются. */
function walls(lo: number, hi: number, obstacles: Rect[]): [number, number][] {
  const spans = obstacles
    .filter((o) => o.y < hi && o.y + o.h > lo)
    .map((o): [number, number] => [o.y, o.y + o.h])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  return merged;
}

/** Свободный x в ряду фигур: ближе к ideal и к prev, не поверх чужой линии; null — просвета нет. */
function freeX(
  ideal: number,
  prev: number,
  [y0, y1]: [number, number],
  obstacles: Rect[],
  taken: Lane[],
  width: number,
): number | null {
  const blocked = obstacles
    .filter((o) => o.y < y1 && o.y + o.h > y0)
    .map((o): [number, number] => [o.x - MARGIN, o.x + o.w + MARGIN])
    .sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = [];
  let from = EDGE_PAD;
  for (const [a, b] of blocked) {
    if (a > from) free.push([from, a]);
    from = Math.max(from, b);
  }
  if (from < width - EDGE_PAD) free.push([from, width - EDGE_PAD]);
  const busy = (x: number) =>
    taken.some(
      (l) => l.y0 < y1 && l.y1 > y0 && Math.abs(l.x - x) < LANE_STEP - 0.5,
    );
  const cost = (x: number) => Math.abs(x - ideal) + Math.abs(x - prev);
  let best: number | null = null;
  for (const [a, b] of free) {
    if (b - a < 6) continue;
    const mid = Math.min(Math.max(ideal, a + 3), b - 3);
    for (let k = 0; k <= 6; k++) {
      for (const sign of k === 0 ? [0] : [1, -1]) {
        const x = mid + sign * k * LANE_STEP;
        if (x < a + 3 || x > b - 3 || busy(x)) continue;
        if (best === null || cost(x) < cost(best)) best = x;
      }
    }
  }
  return best;
}

/**
 * Линия от s к t по вертикали. Прямая кривая, если она никого не задевает;
 * иначе — через просветы рядов. Нет просвета — прямая кривая как есть.
 */
export function routeVertical(
  s: Pt,
  t: Pt,
  obstacles: Rect[],
  width: number,
  taken: Lane[] = [],
): Pt[] {
  const plain = smooth(s, t);
  if (isClear(plain, obstacles)) return plain;
  const dir = t.y >= s.y ? 1 : -1;
  const lo = Math.min(s.y, t.y);
  const hi = Math.max(s.y, t.y);
  const rows = walls(lo, hi, obstacles);
  if (dir < 0) rows.reverse();
  const way: Pt[] = [s];
  const used: Lane[] = [];
  for (const [y0, y1] of rows) {
    const mid = (y0 + y1) / 2;
    const ideal = s.x + ((t.x - s.x) * (mid - s.y)) / (t.y - s.y);
    const x = freeX(
      ideal,
      way[way.length - 1].x,
      [y0, y1],
      obstacles,
      taken,
      width,
    );
    if (x === null) return plain;
    used.push({ x, y0, y1 });
    const inside = (y: number) => Math.min(Math.max(y, lo + 2), hi - 2);
    const enter = inside(dir > 0 ? y0 - MARGIN : y1 + MARGIN);
    const leave = inside(dir > 0 ? y1 + MARGIN : y0 - MARGIN);
    way.push({ x, y: enter }, { x, y: leave });
  }
  way.push(t);
  const chain = way
    .slice(1)
    .reduce<Pt[]>((acc, p, i) => [...acc, ...smooth(way[i], p).slice(1)], [s]);
  if (!isClear(chain, obstacles)) return plain;
  taken.push(...used);
  return chain;
}
