import { describe, it, expect } from 'vitest';
import {
  bezierAt,
  chainMid,
  isClear,
  smooth,
  smoothSide,
  type Rect,
} from './diagramCurves';

const box = (x: number, y: number, w = 100, h = 40): Rect => ({ x, y, w, h });

describe('кривые', () => {
  it('smooth: вертикальные касательные на обоих концах', () => {
    const [a, c1, c2, b] = smooth({ x: 0, y: 0 }, { x: 80, y: 100 });
    expect([c1.x, c2.x]).toEqual([a.x, b.x]);
    expect(c1.y).toBeGreaterThan(a.y);
    expect(c2.y).toBeLessThan(b.y);
  });

  it('smoothSide: горизонтальные касательные', () => {
    const [a, c1, c2, b] = smoothSide({ x: 0, y: 0 }, { x: 100, y: 40 });
    expect([c1.y, c2.y]).toEqual([a.y, b.y]);
  });

  it('bezierAt: концы и середина симметричной кривой', () => {
    const p = smooth({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(bezierAt(p, 0)).toEqual({ x: 0, y: 0 });
    expect(bezierAt(p, 1)).toEqual({ x: 100, y: 100 });
    expect(bezierAt(p, 0.5)).toEqual({ x: 50, y: 50 });
  });

  it('chainMid: у цепочки из трёх сегментов — середина среднего', () => {
    const a = smooth({ x: 0, y: 0 }, { x: 0, y: 10 });
    const b = smooth({ x: 0, y: 10 }, { x: 0, y: 110 });
    const c = smooth({ x: 0, y: 110 }, { x: 40, y: 120 });
    const chain = [...a, ...b.slice(1), ...c.slice(1)];
    expect(chainMid(chain).y).toBeCloseTo(60, 5);
  });
});

describe('isClear', () => {
  it('кривая сквозь фигуру — не чистая, мимо — чистая', () => {
    const o = [box(40, 40, 20, 20)];
    expect(isClear(smooth({ x: 50, y: 0 }, { x: 50, y: 100 }), o)).toBe(false);
    expect(isClear(smooth({ x: 200, y: 0 }, { x: 200, y: 100 }), o)).toBe(true);
  });
});
