// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('../apiClient', () => ({ authedFetch: vi.fn() }));
vi.mock('../api', () => ({ reportClientError: vi.fn() }));
// Передача сессии в браузер — только из MAX; хост подменяем, чтобы проверить оба исхода.
const hostId = vi.hoisted(() => ({ current: 'max' }));
vi.mock('../../../shared/src/host', () => ({ getHost: () => ({ id: hostId.current }) }));
import { authedFetch } from '../apiClient';
import { reportClientError } from '../api';
import { _resetInstallHandoffForTests, useInstallHandoff } from './useInstallHandoff';

const CODE = 'a'.repeat(64);
const CODE2 = 'b'.repeat(64);
const ok = (deviceCode: string, expiresIn = 120) =>
  ({ ok: true, status: 200, json: () => Promise.resolve({ deviceCode, expiresIn }) }) as unknown as Response;

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  _resetInstallHandoffForTests();
  hostId.current = 'max';
});

describe('useInstallHandoff', () => {
  it('до ответа — адрес без кода, после — с кодом во фрагменте', async () => {
    vi.mocked(authedFetch).mockResolvedValue(ok(CODE));
    const { result } = renderHook(() => useInstallHandoff());
    expect(result.current.href).toMatch(/\/install$/);
    await waitFor(() => expect(result.current.href).toMatch(new RegExp(`/install#h=${CODE}$`)));
    const [path, init] = vi.mocked(authedFetch).mock.calls[0];
    expect(path).toBe('/api/auth/ticket/handoff');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ hostId: 'max' });
  });

  // Запрос РКН 2026-11: вход на сайт через Telegram убран, а сессия, переданная
  // из Telegram во внешний браузер, — тот же вход. Код не запрашивается вовсе.
  it.each(['telegram', 'web'])('хост %s: кода нет, сервер не дёргается', async (id) => {
    hostId.current = id;
    vi.mocked(authedFetch).mockResolvedValue(ok(CODE));
    const { result } = renderHook(() => useInstallHandoff());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.href).toMatch(/\/install$/);
    expect(authedFetch).not.toHaveBeenCalled();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('ошибка — адрес без кода и сообщение об аварии', async () => {
    vi.mocked(authedFetch).mockRejectedValue(new Error('сеть'));
    const { result } = renderHook(() => useInstallHandoff());
    await waitFor(() => expect(reportClientError).toHaveBeenCalled());
    expect(result.current.href).toMatch(/\/install$/);
    expect(vi.mocked(reportClientError).mock.calls[0][0]).toMatchObject({ section: 'install.handoff' });
  });

  it('не-2xx тоже считается ошибкой', async () => {
    vi.mocked(authedFetch).mockResolvedValue({ ok: false, status: 500 } as Response);
    renderHook(() => useInstallHandoff());
    await waitFor(() => expect(reportClientError).toHaveBeenCalled());
  });

  it('429 — лимит ручки: адрес без кода, аварией не считается', async () => {
    vi.mocked(authedFetch).mockResolvedValue({ ok: false, status: 429 } as Response);
    const { result } = renderHook(() => useInstallHandoff());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.href).toMatch(/\/install$/);
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('код один на страницу: второй потребитель, пока код жив, сервер не дёргает', async () => {
    vi.mocked(authedFetch).mockResolvedValue(ok(CODE));
    const a = renderHook(() => useInstallHandoff());
    await waitFor(() => expect(a.result.current.href).toContain(CODE));
    const b = renderHook(() => useInstallHandoff());
    expect(b.result.current.href).toContain(CODE);
    await act(async () => { await Promise.resolve(); });
    expect(authedFetch).toHaveBeenCalledTimes(1);
  });

  it('за 10 с до истечения код перевыпускается — один раз', async () => {
    vi.useFakeTimers();
    vi.mocked(authedFetch)
      .mockResolvedValueOnce(ok(CODE))
      .mockResolvedValueOnce(ok(CODE2))
      .mockResolvedValue(ok(CODE2));
    const { result, unmount } = renderHook(() => useInstallHandoff());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.href).toContain(CODE);
    await act(async () => { await vi.advanceTimersByTimeAsync(110_000); });
    expect(authedFetch).toHaveBeenCalledTimes(2);
    expect(result.current.href).toContain(CODE2);
    await act(async () => { await vi.advanceTimersByTimeAsync(110_000 * 5); });
    expect(authedFetch).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('после размонтирования таймер чистится', async () => {
    vi.useFakeTimers();
    vi.mocked(authedFetch).mockResolvedValue(ok(CODE));
    const { unmount } = renderHook(() => useInstallHandoff());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    unmount();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(authedFetch).toHaveBeenCalledTimes(1);
  });
});
