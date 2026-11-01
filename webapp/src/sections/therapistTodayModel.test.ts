import { describe, it, expect, vi } from 'vitest';
import { localDateStr } from '../../../shared/src/utils/format';
import { forEachTimeZone } from '../../../shared/src/utils/timeZone.test-helpers';
import type { TherapyClientSummary } from '../api';
import {
  activityStatus, daysSinceActive, hasSessionToday, initials, latestIndex, needsAttention,
  sessionTime, sessionsTodaySorted, sparkPoints, todayCounts, clientName,
} from './therapistTodayModel';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 86400000).toISOString();

function c(o: Partial<TherapyClientSummary> = {}): TherapyClientSummary {
  return {
    telegramId: 1 as TherapyClientSummary['telegramId'], name: 'Иван', clientAlias: null, streak: 0,
    lastActiveDate: null, todayIndex: null, recentIndexHistory: [],
    relationCreatedAt: '2026-01-01T00:00:00Z', therapyStartDate: null,
    nextSession: null, meetingDays: [], schemaIds: [], ...o,
  };
}

describe('therapistTodayModel', () => {
  it('имя: алиас важнее имени, иначе #id', () => {
    expect(clientName(c({ clientAlias: 'А', name: 'Б' }))).toBe('А');
    expect(clientName(c({ name: null }))).toBe('#1');
  });

  it('инициалы', () => {
    expect(initials('Анна Крылова')).toBe('АК');
    expect(initials('иван')).toBe('И');
    expect(initials('#555')).toBe('#');
    expect(initials('  ')).toBe('?');
  });

  it('daysSinceActive', () => {
    expect(daysSinceActive(c(), NOW)).toBeNull();
    expect(daysSinceActive(c({ lastActiveDate: ago(4) }), NOW)).toBe(4);
    expect(daysSinceActive(c({ lastActiveDate: ago(-1) }), NOW)).toBe(0);
  });

  it('needsAttention: 3+ дня, null — да, активный сегодня — нет', () => {
    expect(needsAttention(c({ lastActiveDate: ago(2) }), NOW)).toBe(false);
    expect(needsAttention(c({ lastActiveDate: ago(3) }), NOW)).toBe(true);
    expect(needsAttention(c(), NOW)).toBe(true);
    expect(needsAttention(c({ todayIndex: 5 }), NOW)).toBe(false);
  });

  it('счётчики', () => {
    const dow = new Date().getDay(); // дни встреч — по местному дню терапевта
    const list = [
      c({ todayIndex: 7, meetingDays: [dow] }),
      c({ lastActiveDate: ago(5) }),
      c({ lastActiveDate: ago(1) }),
    ];
    expect(todayCounts(list, NOW)).toEqual({ active: 1, total: 3, sessions: 1, attention: 1 });
  });

  it('статус активности', () => {
    expect(activityStatus(c({ todayIndex: 6 }), NOW)).toEqual({ text: 'активность сегодня', tone: 'ok' });
    expect(activityStatus(c(), NOW)).toEqual({ text: 'нет данных', tone: 'warn' });
    expect(activityStatus(c({ lastActiveDate: ago(0) }), NOW)).toEqual({ text: 'активность сегодня', tone: 'ok' });
    expect(activityStatus(c({ lastActiveDate: ago(1) }), NOW)).toEqual({ text: 'активность вчера', tone: 'none' });
    expect(activityStatus(c({ lastActiveDate: ago(2) }), NOW)).toEqual({ text: 'активность 2 дн. назад', tone: 'none' });
    expect(activityStatus(c({ lastActiveDate: ago(5) }), NOW)).toEqual({ text: 'нет активности 5 дн.', tone: 'warn' });
  });

  it('спарклайн: от старой к новой, пустые дни — нулевая высота', () => {
    const pts = sparkPoints([8, null, 4]);
    expect(pts).toEqual([
      { height: 40, level: 'err' },
      { height: 0, level: 'none' },
      { height: 80, level: 'ok' },
    ]);
    expect(sparkPoints(Array(20).fill(5))).toHaveLength(14);
    expect(sparkPoints([0.2])[0].height).toBe(8);
  });

  it('latestIndex: сегодняшний, иначе свежий из истории', () => {
    expect(latestIndex(c({ todayIndex: 7 }))).toBe(7);
    expect(latestIndex(c({ recentIndexHistory: [null, 6.5, 3] }))).toBe(6.5);
    expect(latestIndex(c())).toBeNull();
  });

  // Встреча — стенные часы терапевта (datetime-local без зоны), «сегодня» —
  // его местный день (правило №25). По UTC в МСК с 00:00 до 03:00 экран
  // показывал вчерашние встречи. 22:30Z — в Иерусалиме и Сиднее уже завтра.
  const LATE_UTC = Date.parse('2026-10-15T22:30:00Z');
  const atLocal = (fn: (today: string, yesterday: string, dow: number) => void) => {
    vi.useFakeTimers({ now: LATE_UTC, toFake: ['Date'] });
    try {
      const now = new Date();
      fn(localDateStr(now), localDateStr(new Date(now.getTime() - 86400000)), now.getDay());
    } finally {
      vi.useRealTimers();
    }
  };

  it('сессии сегодня сортируются по времени, без времени в конце — в любой зоне', () => {
    forEachTimeZone(() => atLocal((today, _y, dow) => {
      const res = sessionsTodaySorted([
        c({ telegramId: 1 as never, meetingDays: [dow] }),
        c({ telegramId: 2 as never, nextSession: `${today}T16:00` }),
        c({ telegramId: 3 as never, nextSession: `${today}T09:00` }),
      ]);
      expect(res.map(x => x.telegramId)).toEqual([3, 2, 1]);
    }));
  });

  it('вчерашняя по местному дню встреча не «сегодня», даже если по UTC ещё вчера', () => {
    forEachTimeZone((tz) => atLocal((today, yesterday) => {
      const past = c({ nextSession: `${yesterday}T19:00` });
      expect(hasSessionToday(past), tz).toBe(false);
      const now = c({ nextSession: `${today}T10:00` });
      expect(hasSessionToday(now), tz).toBe(true);
      expect(sessionTime(now), tz).toBe('10:00');
    }));
  });

  it('прошедшая nextSession не прячет встречу по дням: сегодня в списке, время прежнее', () => {
    forEachTimeZone((tz) => atLocal((_t, _y, dow) => {
      const stale = c({ nextSession: '2026-01-03T07:00', meetingDays: [dow] });
      expect(hasSessionToday(stale), tz).toBe(true);
      expect(sessionTime(stale), tz).toBe('07:00');
      expect(hasSessionToday(c({ nextSession: '2026-01-03T07:00' })), tz).toBe(false);
    }));
  });
});
