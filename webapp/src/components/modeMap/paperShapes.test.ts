import { describe, it, expect } from 'vitest';
import { RIBBON_NOTCH, STEP_RISE, ribbonPath, stepsPath } from './paperShapes';

const points = (d: string) => [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe('ribbonPath — лента триггера', () => {
  it('шесть вершин внутри коробки, вырезы по концам на середине высоты', () => {
    const pts = points(ribbonPath(200, 60));
    expect(pts).toHaveLength(6);
    for (const [x, y] of pts) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(200); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(60); }
    expect(pts).toContainEqual([1 + RIBBON_NOTCH, 30]);
    expect(pts).toContainEqual([199 - RIBBON_NOTCH, 30]);
  });
  it('вырез не растёт с шириной и не съедает узкую ленту', () => {
    expect(points(ribbonPath(400, 60))).toContainEqual([1 + RIBBON_NOTCH, 30]);
    expect(points(ribbonPath(30, 20))).toContainEqual([6, 10]);
  });
});

describe('stepsPath — ступени поведения', () => {
  it('три площадки вверх слева направо, ступень постоянной высоты', () => {
    const pts = points(stepsPath(210, 90));
    const tops = [pts[1][1], pts[3][1], pts[5][1]];
    expect(tops).toEqual([1 + 2 * STEP_RISE, 1 + STEP_RISE, 1]);
    expect(pts[2][0]).toBe(70);
    expect(pts[4][0]).toBe(140);
    expect(points(stepsPath(210, 300))[1][1]).toBe(1 + 2 * STEP_RISE);
  });
  it('низкая фигура: ступени не выше трети высоты', () => {
    expect(points(stepsPath(120, 24))[1][1]).toBe(9);
  });
});
