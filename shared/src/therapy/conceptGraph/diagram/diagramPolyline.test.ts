import { describe, it, expect } from 'vitest';
import { badgePoint, rounded, sampleChain } from './diagramPolyline';

const P = (x: number, y: number) => ({ x, y });

describe('rounded', () => {
  it('цепочка кубических кривых: 1 + 3k точек, начало и конец на месте', () => {
    const pts = [P(0, 0), P(100, 0), P(100, 100)];
    const c = rounded(pts, 10);
    expect((c.length - 1) % 3).toBe(0);
    expect(c[0]).toEqual(P(0, 0));
    expect(c[c.length - 1]).toEqual(P(100, 100));
  });

  it('угол скруглён: кривая не заходит в сам угол ломаной', () => {
    const c = sampleChain(rounded([P(0, 0), P(100, 0), P(100, 100)], 12));
    expect(c.every((p) => !(p.x > 99.5 && p.y < 0.5))).toBe(true);
    // но вертикальный и горизонтальный участки прямые
    expect(c.some((p) => Math.abs(p.y) < 0.01 && p.x > 50 && p.x < 85)).toBe(
      true,
    );
    expect(
      c.some((p) => Math.abs(p.x - 100) < 0.01 && p.y > 40 && p.y < 85),
    ).toBe(true);
  });

  it('радиус не больше половины короткого отрезка', () => {
    const c = sampleChain(rounded([P(0, 0), P(10, 0), P(10, 100)], 50));
    // угол в (10, 0), короткий отрезок 10 → радиус 5: кривая не уходит левее/ниже
    expect(c.every((p) => p.x <= 10.01 && p.y >= -0.01)).toBe(true);
  });

  it('повторяющиеся точки и две точки подряд не ломают цепочку', () => {
    const c = rounded([P(0, 0), P(0, 0), P(50, 0)], 10);
    expect(c[0]).toEqual(P(0, 0));
    expect(c[c.length - 1]).toEqual(P(50, 0));
    expect(rounded([P(5, 5)], 10)).toEqual([
      P(5, 5),
      P(5, 5),
      P(5, 5),
      P(5, 5),
    ]);
    expect(rounded([], 10)).toEqual([]);
  });
});

describe('badgePoint', () => {
  const line = rounded([P(0, 0), P(200, 0)], 10);

  it('чистая линия: значок посередине', () => {
    const p = badgePoint(line, []);
    expect(p.x).toBeGreaterThan(90);
    expect(p.x).toBeLessThan(110);
  });

  it('середина под фигурой: значок сдвигается на свободное место', () => {
    const p = badgePoint(line, [{ x: 80, y: -20, w: 40, h: 40 }]);
    expect(p.x < 80 - 12 || p.x > 120 + 12).toBe(true);
  });

  it('значок не садится вплотную к концам линии', () => {
    const p = badgePoint(line, [{ x: 20, y: -20, w: 160, h: 40 }]);
    expect(p.x).toBeGreaterThan(18);
    expect(p.x).toBeLessThan(182);
  });
});
