// Регресс «постоянно нужно логиниться заново» (диагностика 2026-08-21):
// временная ошибка refresh-эндпоинта (сеть/5xx/429) не должна выглядеть как
// «сессия истекла». Здесь — чистая классификация и цикл ретраев, без React и
// без сети, общие для webapp/AuthProvider и schema-miniapp/session.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyRefreshFailure,
  renewWithRetries,
  nextRetryTimerDelayMs,
  REFRESH_RETRY_DELAYS_MS,
  RETRY_TIMER_DELAYS_MS,
  type RenewAttemptResult,
} from './sessionRefresh';

describe('classifyRefreshFailure', () => {
  it('401 — сессия мертва', () => {
    expect(classifyRefreshFailure(401)).toBe('dead');
  });

  it('403 — тоже мертва (не только 401)', () => {
    expect(classifyRefreshFailure(403)).toBe('dead');
  });

  it('null (сетевая ошибка/таймаут) — временная беда', () => {
    expect(classifyRefreshFailure(null)).toBe('transient');
  });

  it.each([500, 502, 503, 429, 200])(
    'статус %i — временная беда, не смерть сессии',
    (status) => {
      expect(classifyRefreshFailure(status)).toBe('transient');
    },
  );
});

describe('renewWithRetries', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('успех с первой попытки — без ретраев', async () => {
    const attempt = vi.fn<[], Promise<RenewAttemptResult>>().mockResolvedValue({ ok: true });
    await expect(renewWithRetries(attempt)).resolves.toEqual({ ok: true });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('dead-исход останавливает цикл немедленно, без задержки', async () => {
    const attempt = vi.fn<[], Promise<RenewAttemptResult>>().mockResolvedValue({ ok: false, dead: true });
    const result = await renewWithRetries(attempt);
    expect(result).toEqual({ ok: false, dead: true });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('transient ретраится с бэкоффом и в итоге может выйти успехом', async () => {
    const attempt = vi
      .fn<[], Promise<RenewAttemptResult>>()
      .mockResolvedValueOnce({ ok: false, dead: false })
      .mockResolvedValueOnce({ ok: false, dead: false })
      .mockResolvedValueOnce({ ok: true });

    const promise = renewWithRetries(attempt);
    // Между попытками — ровно бэкофф REFRESH_RETRY_DELAYS_MS.
    for (const delay of REFRESH_RETRY_DELAYS_MS) {
      await vi.advanceTimersByTimeAsync(delay);
    }
    await expect(promise).resolves.toEqual({ ok: true });
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('transient, ретраи исчерпаны — итог false с dead:false (сессия жива, просто сети нет)', async () => {
    const attempt = vi.fn<[], Promise<RenewAttemptResult>>().mockResolvedValue({ ok: false, dead: false });
    const promise = renewWithRetries(attempt);
    for (const delay of REFRESH_RETRY_DELAYS_MS) {
      await vi.advanceTimersByTimeAsync(delay);
    }
    await expect(promise).resolves.toEqual({ ok: false, dead: false });
    // Первая попытка + одна на каждую задержку бэкоффа.
    expect(attempt).toHaveBeenCalledTimes(REFRESH_RETRY_DELAYS_MS.length + 1);
  });
});

describe('nextRetryTimerDelayMs', () => {
  it('растёт с номером попытки и упирается в потолок массива', () => {
    RETRY_TIMER_DELAYS_MS.forEach((expected, i) => {
      expect(nextRetryTimerDelayMs(i)).toBe(expected);
    });
    const last = RETRY_TIMER_DELAYS_MS[RETRY_TIMER_DELAYS_MS.length - 1];
    expect(nextRetryTimerDelayMs(RETRY_TIMER_DELAYS_MS.length + 5)).toBe(last);
  });

  it('отрицательный номер не проваливается ниже первого элемента', () => {
    expect(nextRetryTimerDelayMs(-1)).toBe(RETRY_TIMER_DELAYS_MS[0]);
  });
});
