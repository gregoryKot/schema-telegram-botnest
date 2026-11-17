import { describe, it, expect } from 'vitest';
import { gridScale, anxTier } from './gridScale';

describe('gridScale', () => {
  it('обычный размер — сетка ×2, рост идёт целыми ступенями', () => {
    expect([1, 1.2, 1.25, 1.7, 1.75, 2.4].map(gridScale)).toEqual([2, 2, 3, 3, 4, 5]);
  });
  it('не опускается ниже одного пикселя', () => {
    expect(gridScale(0.1)).toBe(1);
  });
});

describe('anxTier', () => {
  it('новая туча — средняя, после второго деления — малая', () => {
    expect(anxTier(1)).toBe('m');
    expect(anxTier(0.85)).toBe('m');
    expect(anxTier(0.85 * 0.85)).toBe('s');
  });
  it('подпитанная критиком — крупная', () => {
    expect(anxTier(1.4)).toBe('l');
    expect(anxTier(2)).toBe('l');
  });
});
