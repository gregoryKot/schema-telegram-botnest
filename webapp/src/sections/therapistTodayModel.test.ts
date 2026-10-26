import { describe, it, expect } from 'vitest';
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
    const dow = new Date().getUTCDay();
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

  it('сессии сегодня сортируются по времени, без времени в конце', () => {
    const d = new Date().toISOString().slice(0, 10);
    const dow = new Date().getUTCDay();
    const res = sessionsTodaySorted([
      c({ telegramId: 1 as never, meetingDays: [dow] }),
      c({ telegramId: 2 as never, nextSession: `${d}T16:00:00Z` }),
      c({ telegramId: 3 as never, nextSession: `${d}T09:00:00Z` }),
    ]);
    expect(res.map(x => x.telegramId)).toEqual([3, 2, 1]);
  });

  it('прошедшая nextSession не прячет встречу по дням: сегодня в списке, время прежнее', () => {
    const dow = new Date().getUTCDay();
    const stale = c({ nextSession: '2026-01-03T07:00', meetingDays: [dow] });
    expect(hasSessionToday(stale)).toBe(true);
    expect(sessionTime(stale)).toBe('07:00');
    expect(hasSessionToday(c({ nextSession: '2026-01-03T07:00' }))).toBe(false);
  });
});
