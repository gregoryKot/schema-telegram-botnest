import { describe, it, expect } from 'vitest';
import { calendarAgoLabel, calendarDaysAgo } from './calendarAgo';
import { forEachTimeZone } from './timeZone.test-helpers';

describe('calendarAgo', () => {
  const TODAY = '2026-10-15';

  it('считает календарные дни, а не часы', () => {
    expect(calendarDaysAgo('2026-10-14', TODAY)).toBe(1);
    expect(calendarDaysAgo('2026-09-15', TODAY)).toBe(30);
    // через переход на зимнее время: сутки длиной 25 ч не дают «0,96 дня»
    expect(calendarDaysAgo('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('подписи: сегодня, вчера, N дн. назад, дальше дата', () => {
    expect(calendarAgoLabel(TODAY, TODAY)).toBe('сегодня');
    expect(calendarAgoLabel('2026-10-14', TODAY)).toBe('вчера');
    expect(calendarAgoLabel('2026-10-10', TODAY)).toBe('5 дн. назад');
    expect(calendarAgoLabel('2026-10-08', TODAY)).toBe('8 окт');
    expect(calendarAgoLabel('2026-09-03', TODAY)).toBe('3 сен');
  });

  it('будущий день и мусор — без «-1 дн. назад» и «NaN»', () => {
    expect(calendarAgoLabel('2026-10-16', TODAY)).toBe('16 окт');
    expect(calendarAgoLabel('нет', TODAY)).toBe('');
  });

  it('одинаково в любой зоне (правило №25)', () => {
    forEachTimeZone((tz) => {
      expect(calendarAgoLabel('2026-10-03', TODAY), tz).toBe('3 окт');
      expect(calendarAgoLabel('2026-10-12', TODAY), tz).toBe('3 дн. назад');
    });
  });
});
