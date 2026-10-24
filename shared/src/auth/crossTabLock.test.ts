// Кросс-табная блокировка refresh (см. crossTabLock.ts) — параллельный
// refresh из двух вкладок одного origin ротирует refresh-куку дважды,
// сервер это трактует как кражу токена (диагностика «постоянно нужно
// логиниться заново», 2026-08-21).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { withCrossTabLock } from './crossTabLock';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('withCrossTabLock', () => {
  it('когда navigator.locks доступен — выполняет fn через locks.request с переданным именем', async () => {
    const request = vi.fn((_name: string, cb: () => Promise<string>) => cb());
    vi.stubGlobal('navigator', { locks: { request } });

    const fn = vi.fn().mockResolvedValue('done');
    await expect(withCrossTabLock('auth-refresh', fn)).resolves.toBe('done');
    expect(request).toHaveBeenCalledWith('auth-refresh', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('без navigator.locks — просто выполняет fn (фолбэк)', async () => {
    vi.stubGlobal('navigator', {});
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withCrossTabLock('auth-refresh', fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('результат/ошибка fn долетают наружу без искажений', async () => {
    vi.stubGlobal('navigator', {});
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(withCrossTabLock('auth-refresh', fn)).rejects.toThrow('boom');
  });
});
