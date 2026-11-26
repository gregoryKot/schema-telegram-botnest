import { describe, it, expect } from 'vitest';
import { ratingShare } from './ratingShare';

describe('ratingShare', () => {
  it('оценка 0–10 → доля высоты, без оценки — 0, выше 10 не растёт', () => {
    expect([0, -1, 2, 6, 10, 12].map(ratingShare)).toEqual([
      0, 0, 0.2, 0.6, 1, 1,
    ]);
  });
});
