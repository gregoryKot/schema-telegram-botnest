import { describe, expect, it } from 'vitest';
import { CHECK_IN_EVEN_H, CHECK_IN_STUB_H, checkInBarH, checkInBars } from './checkInBars';
import { NEED_DATA_PAPER } from './paper';

describe('checkInBars — полоски сцены дня из реальных оценок', () => {
  it('оценки → высоты в порядке NEED_ORDER, цвета данных', () => {
    const b = checkInBars({ attachment: 1, autonomy: 10, expression: 5, play: 2, limits: 7 });
    expect(b.inks).toBe(NEED_DATA_PAPER);
    expect(b.heights).toEqual([40, 130, 80, 50, 100]);
    expect(checkInBarH(1)).toBe(40);
  });

  it('нет ни одной оценки — все одной высоты; частичный день — неоценённые пеньком', () => {
    expect(new Set(checkInBars({}).heights)).toEqual(new Set([CHECK_IN_EVEN_H]));
    expect(new Set(checkInBars().heights)).toEqual(new Set([CHECK_IN_EVEN_H]));
    expect(checkInBars({ play: 6 }).heights).toEqual([
      CHECK_IN_STUB_H, CHECK_IN_STUB_H, CHECK_IN_STUB_H, 90, CHECK_IN_STUB_H,
    ]);
  });
});
