// Полоса вкладок карточки клиента (b30): маска у края, за которым есть вкладки, и прокрутка к активной.
import { describe, it, expect } from 'vitest';
import { fadeClass, tabScrollTarget, tabsFade } from './clientTabsScroll';

describe('tabsFade', () => {
  it('всё помещается — маски нет', () => {
    expect(tabsFade(0, 600, 600)).toEqual({ start: false, end: false });
    expect(tabsFade(0, 601, 600)).toEqual({ start: false, end: false });
  });

  it('в начале — маска только справа, в конце — только слева, посередине — с обеих сторон', () => {
    expect(tabsFade(0, 900, 390)).toEqual({ start: false, end: true });
    expect(tabsFade(510, 900, 390)).toEqual({ start: true, end: false });
    expect(tabsFade(509.4, 900, 390)).toEqual({ start: true, end: false });
    expect(tabsFade(200, 900, 390)).toEqual({ start: true, end: true });
  });
});

describe('tabScrollTarget', () => {
  it('вкладка в середине полосы встаёт по центру', () => {
    expect(tabScrollTarget(500, 80, 390, 900)).toBe(345);
  });

  it('первая вкладка — к началу, последняя — к концу, не дальше краёв', () => {
    expect(tabScrollTarget(16, 60, 390, 900)).toBe(0);
    expect(tabScrollTarget(820, 70, 390, 900)).toBe(510);
  });

  it('полоса без прокрутки — ноль', () => {
    expect(tabScrollTarget(300, 80, 600, 500)).toBe(0);
  });
});

describe('fadeClass', () => {
  it('классы по сторонам маски', () => {
    expect(fadeClass({ start: false, end: false })).toBe('');
    expect(fadeClass({ start: false, end: true })).toBe(' is-fade-end');
    expect(fadeClass({ start: true, end: true })).toBe(' is-fade-start is-fade-end');
  });
});
