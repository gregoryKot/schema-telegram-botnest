import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UserId } from '../userId';
import { forEachTimeZone } from '../utils/timeZone.test-helpers';
import { clientActivityLabel } from './clientActivity';

// Год «сейчас» фиксирован: дата старше недели показывается без года только в текущем.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const bot = (
  o: {
    lastActiveDate?: string | null;
    daysSinceActive?: number | null;
    todayIndex?: number | null;
  } = {},
) => ({
  telegramId: 1 as UserId,
  lastActiveDate: null,
  todayIndex: null,
  ...o,
});
const seen = (days: number, day = '2026-10-01') =>
  bot({ lastActiveDate: day, daysSinceActive: days });

describe('clientActivityLabel', () => {
  it('сегодня / вчера / N дн. назад — по числу дней сервера', () => {
    expect(clientActivityLabel(seen(0))).toBe('активность сегодня');
    expect(clientActivityLabel(seen(1))).toBe('активность вчера');
    expect(clientActivityLabel(seen(2))).toBe('активность 2 дн. назад');
    expect(clientActivityLabel(seen(6))).toBe('активность 6 дн. назад');
  });

  // QA 2026-11: после недели «Сегодня» писало «нет активности 12 дн.»,
  // список — «активность 24 окт». Формулировка одна — дата.
  it('неделя и дольше — дата последней активности, а не «нет активности N дн.»', () => {
    expect(clientActivityLabel(seen(7, '2026-10-08'))).toBe('активность 8 окт');
    expect(clientActivityLabel(seen(12, '2026-10-03'))).toBe(
      'активность 3 окт',
    );
  });

  it('без записей и с нечитаемой датой — «нет активности»', () => {
    expect(clientActivityLabel(bot())).toBe('нет активности');
    expect(
      clientActivityLabel(bot({ lastActiveDate: 'мусор', daysSinceActive: 3 })),
    ).toBe('нет активности');
  });

  it('индекс дня — «сегодня», даже у старого кэша без daysSinceActive', () => {
    expect(clientActivityLabel(bot({ todayIndex: 6.2 }))).toBe(
      'активность сегодня',
    );
    expect(clientActivityLabel(bot({ lastActiveDate: '2026-10-01' }))).toBe(
      'активность 1 окт',
    );
  });

  it('офлайн-клиент (отрицательный id, без аккаунта) — подписи нет', () => {
    expect(clientActivityLabel({ ...bot(), telegramId: -7 })).toBeNull();
  });

  // Календарный день не пересчитывается в зону терапевта (правило №25).
  it('дата одинакова в любой зоне', () => {
    forEachTimeZone((tz) => {
      expect(clientActivityLabel(seen(12, '2026-10-03')), tz).toBe(
        'активность 3 окт',
      );
    });
  });
});
