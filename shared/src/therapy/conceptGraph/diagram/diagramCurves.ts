// Кривые диаграммы: кубические сегменты Безье, точка на кривой и проверка, не
// задевает ли кривая чужую фигуру.
import type { Pt } from './diagramTypes';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SAMPLES = 24;

/** Кривая от a к b с вертикальными касательными на обоих концах. */
export function smooth(a: Pt, b: Pt): Pt[] {
  const k = (b.y - a.y) / 2;
  return [a, { x: a.x, y: a.y + k }, { x: b.x, y: b.y - k }, b];
}

/** Кривая с горизонтальными касательными: для пары фигур в одном ряду. */
export function smoothSide(a: Pt, b: Pt): Pt[] {
  const k = (b.x - a.x) / 2;
  return [a, { x: a.x + k, y: a.y }, { x: b.x - k, y: b.y }, b];
}

export function bezierAt(p: Pt[], t: number): Pt {
  const [a, b, c, d] = p;
  const u = 1 - t;
  const mix = (k: 'x' | 'y') =>
    u * u * u * a[k] +
    3 * u * u * t * b[k] +
    3 * u * t * t * c[k] +
    t * t * t * d[k];
  return { x: mix('x'), y: mix('y') };
}

export function isClear(points: Pt[], obstacles: Rect[]): boolean {
  for (let i = 0; i + 3 < points.length; i += 3) {
    for (let s = 1; s < SAMPLES; s++) {
      const p = bezierAt(points.slice(i, i + 4), s / SAMPLES);
      const hit = obstacles.some(
        (o) =>
          p.x > o.x - 2 &&
          p.x < o.x + o.w + 2 &&
          p.y > o.y - 2 &&
          p.y < o.y + o.h + 2,
      );
      if (hit) return false;
    }
  }
  return true;
}
