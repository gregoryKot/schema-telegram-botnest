import { describe, it, expect } from 'vitest';
import { bezierAt, smooth, type Rect } from './diagramCurves';
import { routeVertical, type Lane } from './diagramRoute';

const box = (x: number, y: number, w = 100, h = 40): Rect => ({ x, y, w, h });
/** Ряд фигур с просветом посередине: [0,100] и [140,240], просвет 100..140. */
const wall: Rect[] = [box(0, 100), box(140, 100, 100)];

const inside = (p: { x: number; y: number }, o: Rect) =>
  p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h;

/** Все точки цепочки, плотно. */
function sampled(points: { x: number; y: number }[]) {
  const out = [];
  for (let i = 0; i + 3 < points.length; i += 3) {
    for (let k = 0; k <= 50; k++)
      out.push(bezierAt(points.slice(i, i + 4), k / 50));
  }
  return out;
}

describe('routeVertical', () => {
  it('свободный путь остаётся прямой кривой', () => {
    const s = { x: 120, y: 0 };
    const t = { x: 120, y: 300 };
    expect(routeVertical(s, t, [box(300, 100)], 400)).toEqual(smooth(s, t));
  });

  it('преграда посередине: линия идёт по просвету между фигурами и не входит ни в одну', () => {
    const s = { x: 50, y: 0 };
    const t = { x: 50, y: 300 };
    const path = routeVertical(s, t, wall, 300);
    expect(path.length).toBeGreaterThan(4);
    expect(path[0]).toEqual(s);
    expect(path[path.length - 1]).toEqual(t);
    for (const p of sampled(path)) {
      for (const o of wall) expect(inside(p, o)).toBe(false);
    }
  });

  it('ряд без просвета: остаётся прямая кривая, а не ломается', () => {
    const solid = [box(0, 100, 300, 40)];
    const s = { x: 50, y: 0 };
    const t = { x: 50, y: 300 };
    expect(routeVertical(s, t, solid, 300)).toEqual(smooth(s, t));
  });

  it('вверх: линия от низа к верху обходит ряд так же', () => {
    const s = { x: 50, y: 300 };
    const t = { x: 50, y: 0 };
    const path = routeVertical(s, t, wall, 300);
    for (const p of sampled(path)) {
      for (const o of wall) expect(inside(p, o)).toBe(false);
    }
    expect(path[path.length - 1]).toEqual(t);
  });

  it('две линии через один просвет идут рядом, а не поверх друг друга', () => {
    const taken: Lane[] = [];
    const a = routeVertical(
      { x: 40, y: 0 },
      { x: 40, y: 300 },
      wall,
      300,
      taken,
    );
    const b = routeVertical(
      { x: 60, y: 0 },
      { x: 60, y: 300 },
      wall,
      300,
      taken,
    );
    const through = (path: typeof a) => {
      const p = sampled(path).find((q) => q.y > 110 && q.y < 130)!;
      return p.x;
    };
    expect(Math.abs(through(a) - through(b))).toBeGreaterThanOrEqual(2.5);
    expect(through(a)).toBeGreaterThan(100);
    expect(through(b)).toBeLessThan(140);
  });

  it('линия не выходит за поля раскладки', () => {
    const edgeWall = [box(10, 100, 280)];
    const s = { x: 150, y: 0 };
    const t = { x: 150, y: 300 };
    for (const p of sampled(routeVertical(s, t, edgeWall, 300))) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(300);
    }
  });
});
