// @vitest-environment jsdom
// attemptRenewOnce — сетевая половина перевыпуска (см. sessionRenew.ts).
// Регресс «постоянно нужно логиниться заново» (2026-08-21): dead=true обязан
// требовать подтверждённого отказа аутентификации (401/403) с ОБЕИХ сторон,
// когда обе доступны.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attemptRenewOnce } from './sessionRenew';

function jsonRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function fetchMock() {
  return global.fetch as unknown as ReturnType<typeof vi.fn>;
}

const EXCHANGE = { path: '/api/auth/telegram/webapp', body: { initData: 'x' } };

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('attemptRenewOnce', () => {
  it('refresh ok — exchange не вызывается', async () => {
    fetchMock().mockResolvedValueOnce(
      jsonRes(200, { accessToken: 't', expiresIn: 900 }),
    );
    const result = await attemptRenewOnce(EXCHANGE);
    expect(result).toEqual({ ok: true, token: 't', expiresIn: 900 });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('refresh 401, exchange ok — успех через exchange', async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonRes(401, {}))
      .mockResolvedValueOnce(
        jsonRes(200, { accessToken: 'e', expiresIn: 900 }),
      );
    await expect(attemptRenewOnce(EXCHANGE)).resolves.toEqual({
      ok: true,
      token: 'e',
      expiresIn: 900,
    });
  });

  it('refresh 401, exchange 401 — dead:true (оба подтвердили отказ)', async () => {
    fetchMock().mockResolvedValue(jsonRes(401, {}));
    await expect(attemptRenewOnce(EXCHANGE)).resolves.toEqual({
      ok: false,
      dead: true,
    });
  });

  it('refresh 401, exchange 500 — dead:false (хотя бы один путь временный)', async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonRes(401, {}))
      .mockResolvedValueOnce(jsonRes(500, {}));
    await expect(attemptRenewOnce(EXCHANGE)).resolves.toEqual({
      ok: false,
      dead: false,
    });
  });

  it('refresh 500, exchange 401 — dead:false (та же симметрия)', async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonRes(500, {}))
      .mockResolvedValueOnce(jsonRes(401, {}));
    await expect(attemptRenewOnce(EXCHANGE)).resolves.toEqual({
      ok: false,
      dead: false,
    });
  });

  it('нет exchange (например, web-хост без initData) — судим только по refresh', async () => {
    fetchMock().mockResolvedValue(jsonRes(401, {}));
    await expect(attemptRenewOnce(null)).resolves.toEqual({
      ok: false,
      dead: true,
    });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('сетевая ошибка на refresh без exchange — dead:false', async () => {
    fetchMock().mockRejectedValue(new TypeError('offline'));
    await expect(attemptRenewOnce(null)).resolves.toEqual({
      ok: false,
      dead: false,
    });
  });
});
