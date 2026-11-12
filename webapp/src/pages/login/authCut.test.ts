// Срез листа-героя входа (authCut.ts): одни точки на обе стороны — сбоку (компьютер) и снизу
// (телефон). Контур замкнут по краю листа, не выходит за холст 24×1200, и нижний слой выглядывает
// из-под верхнего (заходит дальше наружу хотя бы в одной точке) — иначе это обводка, а не лист.
import { describe, it, expect } from 'vitest';
import { cutPath, cutViewBox } from './authCut';

const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const pairs = (d: string) => {
  const n = nums(d);
  return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]] as const);
};

describe('cutPath', () => {
  it.each(['right', 'bottom'] as const)('%s: замкнут от края листа и лежит в холсте', (side) => {
    for (const layer of ['under', 'top'] as const) {
      const d = cutPath(layer, side);
      expect(d.startsWith('M0 0 ')).toBe(true);
      expect(d.endsWith(' Z')).toBe(true);
      const [, , w, h] = cutViewBox(side).split(' ').map(Number);
      for (const [x, y] of pairs(d)) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(w);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(h);
      }
    }
  });

  it('сбоку и снизу — те же точки, переставленные по осям', () => {
    const right = pairs(cutPath('top', 'right')).map(([x, y]) => `${y} ${x}`);
    const bottom = pairs(cutPath('top', 'bottom')).map(([x, y]) => `${x} ${y}`);
    expect(right.slice(1, -1)).toEqual(bottom.slice(1, -1));
  });

  it('нижний слой выходит за верхний: подложенный лист, а не обводка', () => {
    const out = (layer: 'under' | 'top') => Math.max(...pairs(cutPath(layer, 'bottom')).map(([, y]) => y));
    expect(out('under')).toBeGreaterThan(out('top'));
  });
});
