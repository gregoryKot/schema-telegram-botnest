import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { localDateStr } from '../../../shared/src/utils/format';
import { forEachTimeZone } from '../../../shared/src/utils/timeZone.test-helpers';
import type { TherapyClientSummary } from '../api';
import { clientCaption } from '../components/therapist/rosterModel';
import {
  activityStatus, daysSinceActive, hasSessionToday, latestIndex, needsAttention,
  sessionTime, sessionsTodaySorted, sparkPoints, todayCounts, trackedClients,
} from './therapistTodayModel';

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

  // QA 2026-11: у офлайн-клиента daysSinceActive всегда null — он вечно
  // «требовал внимания» и раздувал знаменатель «Активны». Встреча с ним настоящая.
  it('офлайн-клиент: не требует внимания, не в «Активны», но его сессия считается', () => {
    const offline = c({ telegramId: -3 as TherapyClientSummary['telegramId'], meetingDays: [THU] });
    expect(needsAttention(offline)).toBe(false);
    expect(trackedClients([c(), offline])).toEqual([c()]);
    expect(todayCounts([c({ todayIndex: 7 }), c(), offline]))
      .toEqual({ active: 1, total: 2, sessions: 1, attention: 1 });
    expect(activityStatus(offline)).toEqual({ text: '', tone: 'none' });
  });

  it('статус активности: текст — давность, тон — сегодня / требует внимания', () => {
    expect(activityStatus(c({ todayIndex: 6 }))).toEqual({ text: 'активность сегодня', tone: 'ok' });
    expect(activityStatus(c())).toEqual({ text: 'нет активности', tone: 'warn' });
    expect(activityStatus(c(ago(0)))).toEqual({ text: 'активность сегодня', tone: 'ok' });
    expect(activityStatus(c(ago(1)))).toEqual({ text: 'активность вчера', tone: 'none' });
    expect(activityStatus(c(ago(2)))).toEqual({ text: 'активность 2 дн. назад', tone: 'none' });
    expect(activityStatus(c(ago(5)))).toEqual({ text: 'активность 5 дн. назад', tone: 'warn' });
    expect(activityStatus(c(ago(14)))).toEqual({ text: 'активность 1 окт', tone: 'warn' });
  });

  // QA 2026-11: две функции подписывали одну давность по-разному — «Сегодня»
  // «нет активности 12 дн.», список клиентов «активность 24 окт». Сверка
  // (правило №4): для клиента без срока в работе и стрика строки совпадают.
  it('«Сегодня» и список клиентов подписывают давность одной строкой', () => {
    for (const o of [{}, { todayIndex: 6 }, ago(0), ago(1), ago(2), ago(5), ago(14)]) {
      const client = c(o);
      expect(activityStatus(client).text, JSON.stringify(o)).toBe(clientCaption(client));
    }
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
