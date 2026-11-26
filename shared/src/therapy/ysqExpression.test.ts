// Выраженность схем в данных с сервера для экранов терапевта (QA 2026-10-26).
import { describe, it, expect } from 'vitest';
import {
  isServerScoreActive,
  sortByExpression,
  ysqAvgLabel,
} from './ysqExpression';

describe('isServerScoreActive', () => {
  it('флаг бэкенда главнее цифр', () => {
    expect(
      isServerScoreActive({ id: 'a', pct5plus: 90, avg: 5, active: false }),
    ).toBe(false);
    expect(
      isServerScoreActive({ id: 'a', pct5plus: 0, avg: 4, active: true }),
    ).toBe(true);
  });

  it('без флага — общий критерий: средний от 4 или больше половины «5–6»', () => {
    expect(isServerScoreActive({ id: 'a', pct5plus: 0, avg: 4 })).toBe(true);
    expect(isServerScoreActive({ id: 'a', pct5plus: 51 })).toBe(true);
    expect(isServerScoreActive({ id: 'a', pct5plus: 50, avg: 3.9 })).toBe(
      false,
    );
  });
});

describe('sortByExpression', () => {
  it('выраженные первыми, затем средний балл, затем доля «5–6», при равенстве — исходный порядок', () => {
    const sorted = sortByExpression([
      { id: 'quiet', pct5plus: 40, avg: 4.5, active: false },
      { id: 'byAvg', pct5plus: 0, avg: 4, active: true },
      { id: 'top', pct5plus: 100, avg: 6, active: true },
      { id: 'tieA', pct5plus: 60, avg: 4, active: true },
      { id: 'tieB', pct5plus: 60, avg: 4, active: true },
    ]);
    expect(sorted.map((s) => s.id)).toEqual([
      'top',
      'tieA',
      'tieB',
      'byAvg',
      'quiet',
    ]);
  });
});

describe('ysqAvgLabel', () => {
  it('«4/6»; нет балла — «–»', () => {
    expect(ysqAvgLabel(4)).toBe('4/6');
    expect(ysqAvgLabel(4.6)).toBe('4.6/6');
    expect(ysqAvgLabel(0)).toBe('–');
    expect(ysqAvgLabel(undefined)).toBe('–');
  });
});
