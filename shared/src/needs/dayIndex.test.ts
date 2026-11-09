import { describe, it, expect } from 'vitest';
import { dayIndex, fmtIndex, fmtIndexDelta } from './dayIndex';

describe('dayIndex', () => {
  it('среднее, когда оценены все потребности', () => {
    expect(dayIndex(['a', 'b'], { a: 4, b: 7 })).toBe(5.5);
  });
  it('не все оценены или потребностей нет — null', () => {
    expect(dayIndex(['a', 'b'], { a: 4 })).toBeNull();
    expect(dayIndex([], {})).toBeNull();
  });
  it('оценка 0 — «не оценено»: индекса нет, ноль в среднее не идёт', () => {
    expect(dayIndex(['a', 'b'], { a: 4, b: 0 })).toBeNull();
  });
});

describe('fmtIndex', () => {
  it('десятичная запятая и один знак после неё', () => {
    expect(fmtIndex(6.44)).toBe('6,4');
    expect(fmtIndex(6)).toBe('6,0');
    expect(fmtIndex(0)).toBe('0,0');
  });
  it('нет индекса — прочерк, а не выдуманный ноль', () => {
    expect(fmtIndex(null)).toBe('—');
    expect(fmtIndex(undefined)).toBe('—');
  });
});

describe('fmtIndexDelta', () => {
  it('знак всегда: «+2,0», «−1,5» (типографский минус), ноль — с плюсом', () => {
    expect(fmtIndexDelta(2)).toBe('+2,0');
    expect(fmtIndexDelta(-1.46)).toBe('−1,5');
    expect(fmtIndexDelta(0)).toBe('+0,0');
  });
});
