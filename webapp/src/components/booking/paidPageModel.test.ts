// Аудит 2026-10 (docs/open/audit-2026-10.md, «Автоповтор экрана после
// оплаты»): опрос брони каждые 5 с две минуты — 24 запроса на визит при
// лимите by-token 60 в час с IP; два платежа с одного адреса упирались в 429.
// Теперь пауза растёт 5 → 10 → 20 с и дальше по 20: подтверждение видно не
// позже чем через 20 с после вебхука, а запросов на визит — девять.
import { describe, it, expect } from 'vitest';
import {
  nextPollDelayMs,
  POLL_INTERVAL_MS,
  POLL_LIMIT_MS,
  POLL_MAX_INTERVAL_MS,
} from './paidPageModel';

/** Моменты запросов за один визит, как их ставит useBookingByToken. */
function requestMoments(): number[] {
  const at = [0];
  for (let attempt = 0; at[at.length - 1] < POLL_LIMIT_MS; attempt++)
    at.push(at[at.length - 1] + nextPollDelayMs(attempt, at[at.length - 1]));
  return at;
}

describe('nextPollDelayMs — бэкофф опроса брони после оплаты', () => {
  it('5 → 10 → 20 → 20 с: удваивается от первой паузы до потолка', () => {
    expect([0, 1, 2, 3, 10].map((n) => nextPollDelayMs(n, 0))).toEqual([
      5_000, 10_000, 20_000, 20_000, 20_000,
    ]);
    expect(POLL_INTERVAL_MS).toBe(5_000);
    expect(POLL_MAX_INTERVAL_MS).toBe(20_000);
  });

  it('последний запрос — ровно на конце ожидания, не позже', () => {
    expect(nextPollDelayMs(5, 115_000)).toBe(5_000);
    expect(nextPollDelayMs(5, POLL_LIMIT_MS)).toBe(0);
    expect(requestMoments().at(-1)).toBe(POLL_LIMIT_MS);
  });

  it('визит — девять запросов: лимит by-token (60 в час с IP) выдерживает шесть оплат с одного адреса', () => {
    const moments = requestMoments();
    expect(moments).toEqual([
      0, 5_000, 15_000, 35_000, 55_000, 75_000, 95_000, 115_000, 120_000,
    ]);
    expect(Math.floor(60 / moments.length)).toBeGreaterThanOrEqual(6);
  });

  it('между соседними запросами не больше 20 с — подтверждение не запаздывает сильнее', () => {
    const m = requestMoments();
    const gaps = m.slice(1).map((t, i) => t - m[i]);
    expect(Math.max(...gaps)).toBe(POLL_MAX_INTERVAL_MS);
  });
});
