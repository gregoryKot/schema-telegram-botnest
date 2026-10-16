import { describe, it, expect } from 'vitest';
import { laneRoute, laneXs } from './diagramLanes';
import { LANE_ZONE } from './diagramNarrow';
import { sampleChain } from './diagramPolyline';

const item = (side: 'left' | 'right', y0: number, y1: number) => ({
  side,
  s: { x: 50, y: y0 },
  t: { x: 50, y: y1 },
});

const COL = { x: 34, w: 322 };

describe('laneXs', () => {
  it('левые дорожки — слева от колонки фигур, правые — справа, вплотную к ней', () => {
    const xs = laneXs([item('left', 0, 100), item('right', 0, 100)], COL);
    expect(xs[0]).toBeLessThan(COL.x);
    expect(xs[0]).toBeGreaterThanOrEqual(COL.x - LANE_ZONE);
    expect(xs[1]).toBeGreaterThan(COL.x + COL.w);
    expect(xs[1]).toBeLessThanOrEqual(COL.x + COL.w + LANE_ZONE);
  });

  it('на широком контейнере дорожки идут за колонкой, а не у края экрана', () => {
    const wide = { x: 254, w: 420 };
    const [x] = laneXs([item('left', 0, 100)], wide);
    expect(x).toBeGreaterThan(wide.x - LANE_ZONE);
  });

  it('длинная линия получает внешнюю дорожку, короткая — внутреннюю (вложенные не пересекаются)', () => {
    const xs = laneXs([item('left', 100, 200), item('left', 0, 500)], COL);
    expect(xs[1]).toBeLessThan(xs[0]);
    const right = laneXs([item('right', 100, 200), item('right', 0, 500)], COL);
    expect(right[1]).toBeGreaterThan(right[0]);
  });

  it('все дорожки разные и укладываются в полосу даже для многих линий', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      item('left', 0, 100 + i * 10),
    );
    const xs = laneXs(items, COL);
    expect(new Set(xs).size).toBe(10);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(COL.x - LANE_ZONE);
      expect(x).toBeLessThan(COL.x);
    }
  });

  it('пустой список — пустой результат', () => {
    expect(laneXs([], COL)).toEqual([]);
  });
});

describe('laneRoute', () => {
  it('скобка: линия уходит вбок на дорожку, спускается и входит в цель', () => {
    const s = { x: 60, y: 10 };
    const t = { x: 80, y: 300 };
    const pts = sampleChain(laneRoute(s, t, 8));
    expect(pts[0]).toEqual(s);
    expect(pts[pts.length - 1]).toEqual(t);
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(8, 0);
    expect(
      pts.some((p) => Math.abs(p.x - 8) < 0.01 && p.y > 100 && p.y < 200),
    ).toBe(true);
  });
});
