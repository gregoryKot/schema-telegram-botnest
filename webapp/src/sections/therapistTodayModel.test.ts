import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TherapyClientSummary } from '../api';
import {
  activityStatus, daysSinceActive, hasSessionToday, initials, latestIndex, needsAttention,
  sessionTime, sessionsTodaySorted, sparkPoints, todayCounts, clientName,
} from './therapistTodayModel';
import { withTimeZone } from '../../../shared/src/utils/timeZone.test-helpers';

// 12:00 UTC 15 октября 2026 — четверг (4) во всех зонах прогона CI.
const NOW = '2026-10-15T12:00:00Z';
const THU = 4;
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW)); });
afterEach(() => vi.useRealTimers());
// Дни с последней оценки считает сервер по календарю клиента (QA 2026-10-26).
const ago = (d: number) => ({ daysSinceActive: d, lastActiveDate: '2026-10-01' });

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

  it('daysSinceActive — значение сервера (календарь клиента), без пересчёта от «сейчас»', () => {
    expect(daysSinceActive(c())).toBeNull();
    expect(daysSinceActive(c({ lastActiveDate: '2026-10-01' }))).toBeNull(); // старый кэш без поля
    expect(daysSinceActive(c(ago(4)))).toBe(4);
    expect(daysSinceActive(c(ago(0)))).toBe(0);
  });

  it('needsAttention: 3+ дня, null — да, активный сегодня — нет', () => {
    expect(needsAttention(c(ago(2)))).toBe(false);
    expect(needsAttention(c(ago(3)))).toBe(true);
    expect(needsAttention(c())).toBe(true);
    expect(needsAttention(c({ todayIndex: 5 }))).toBe(false);
  });

  it('счётчики', () => {
    const list = [
      c({ todayIndex: 7, meetingDays: [THU] }),
      c(ago(5)),
      c(ago(1)),
    ];
    expect(todayCounts(list)).toEqual({ active: 1, total: 3, sessions: 1, attention: 1 });
  });

  it('статус активности', () => {
    expect(activityStatus(c({ todayIndex: 6 }))).toEqual({ text: 'активность сегодня', tone: 'ok' });
    expect(activityStatus(c())).toEqual({ text: 'нет данных', tone: 'warn' });
    expect(activityStatus(c(ago(0)))).toEqual({ text: 'активность сегодня', tone: 'ok' });
    expect(activityStatus(c(ago(1)))).toEqual({ text: 'активность вчера', tone: 'none' });
    expect(activityStatus(c(ago(2)))).toEqual({ text: 'активность 2 дн. назад', tone: 'none' });
    expect(activityStatus(c(ago(5)))).toEqual({ text: 'нет активности 5 дн.', tone: 'warn' });
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
    const res = sessionsTodaySorted([
      c({ telegramId: 1 as never, meetingDays: [THU] }),
      c({ telegramId: 2 as never, nextSession: '2026-10-15T16:00' }),
      c({ telegramId: 3 as never, nextSession: '2026-10-15T09:00' }),
    ]);
    expect(res.map(x => x.telegramId)).toEqual([3, 2, 1]);
  });

  // QA 2026-10-26, 00:10 по Москве (21:10 UTC): «Сессии сегодня» сверялись с
  // днём UTC — вчерашняя 23:00 была в списке, сегодняшняя 15:00 пропадала.
  it('сессии сегодня — по местному дню терапевта, не по UTC', () => {
    vi.setSystemTime(new Date('2026-10-26T21:10:00Z'));
    const yesterday = c({ nextSession: '2026-10-26T23:00' });
    const today = c({ nextSession: '2026-10-27T15:00' });
    withTimeZone('Europe/Moscow', () => {
      expect(hasSessionToday(yesterday)).toBe(false);
      expect(hasSessionToday(today)).toBe(true);
      expect(sessionTime(today)).toBe('15:00');
    });
    withTimeZone('America/Los_Angeles', () => {
      expect(hasSessionToday(yesterday)).toBe(true);
      expect(hasSessionToday(today)).toBe(false);
    });
  });

  it('прошедшая nextSession не прячет встречу по дням: сегодня в списке, время прежнее', () => {
    const stale = c({ nextSession: '2026-01-03T07:00', meetingDays: [THU] });
    expect(hasSessionToday(stale)).toBe(true);
    expect(sessionTime(stale)).toBe('07:00');
    expect(hasSessionToday(c({ nextSession: '2026-01-03T07:00' }))).toBe(false);
  });
});
