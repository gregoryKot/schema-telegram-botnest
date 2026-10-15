// @vitest-environment jsdom
// Флаш офлайн-очереди только после выпуска сессии (E-1, аудит 2026-10).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const renewSession = vi.fn<() => Promise<boolean>>();
const flushOutbox = vi.fn<() => Promise<void>>();
vi.mock('../session', () => ({ renewSession: () => renewSession() }));
vi.mock('../api', () => ({ api: { flushOutbox: () => flushOutbox() } }));

import { useOutboxFlush } from './useOutboxFlush';

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  renewSession.mockReset();
  flushOutbox.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(cleanup);

describe('useOutboxFlush', () => {
  it('на старте флаш не уходит, пока сессия не выпущена, и уходит один раз после', async () => {
    let release: (ok: boolean) => void = () => {};
    renewSession.mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );
    renderHook(() => useOutboxFlush());
    await settle();
    expect(flushOutbox).not.toHaveBeenCalled();
    release(true);
    await settle();
    expect(flushOutbox).toHaveBeenCalledTimes(1);
  });

  it('сессию получить не удалось → флаша нет, очередь цела', async () => {
    renewSession.mockResolvedValue(false);
    renderHook(() => useOutboxFlush());
    await settle();
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(flushOutbox).not.toHaveBeenCalled();
  });

  it('online: флаш ждёт перевыпуска сессии', async () => {
    renewSession.mockResolvedValueOnce(false);
    renderHook(() => useOutboxFlush());
    await settle();
    let release: (ok: boolean) => void = () => {};
    renewSession.mockReturnValueOnce(
      new Promise((r) => {
        release = r;
      }),
    );
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(flushOutbox).not.toHaveBeenCalled();
    release(true);
    await settle();
    expect(flushOutbox).toHaveBeenCalledTimes(1);
  });

  it('падение renew не даёт необработанного отказа и не флашит', async () => {
    renewSession.mockRejectedValue(new Error('boom'));
    renderHook(() => useOutboxFlush());
    await settle();
    expect(flushOutbox).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'flushOutbox',
      expect.any(Error),
    );
  });

  it('отдаёт состояние сети по offline/online', async () => {
    renewSession.mockResolvedValue(true);
    const { result } = renderHook(() => useOutboxFlush());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(false);
    await settle();
  });
});
