// @vitest-environment jsdom
// Защита кнопки «Запросить тест на схемы»: пока запрос в полёте, повторные
// тапы не плодят запросы (иначе клиент получает серию одинаковых DM).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useYsqRequest, YSQ_REQUEST_ERROR } from './useYsqRequest';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useYsqRequest', () => {
  it('три тапа, пока первый запрос в полёте → send вызван один раз', async () => {
    let resolve!: () => void;
    const send = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { result } = renderHook(() => useYsqRequest(7, send));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleRequestYsq();
      void result.current.handleRequestYsq();
      void result.current.handleRequestYsq();
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(7);
    await act(async () => {
      resolve();
      await pending;
    });
    expect(result.current.ysqRequested).toBe(true);
  });

  it('после ответа (успех) защита снимается: новый запрос уходит', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useYsqRequest(7, send));
    await act(() => result.current.handleRequestYsq());
    await act(() => result.current.handleRequestYsq());
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('после ошибки защита снимается, ошибка видна, повтор уходит и чистит ошибку', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useYsqRequest(7, send));
    await act(() => result.current.handleRequestYsq());
    expect(result.current.ysqError).toBe(YSQ_REQUEST_ERROR);
    expect(result.current.ysqRequested).toBe(false);
    await act(() => result.current.handleRequestYsq());
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.current.ysqError).toBe('');
  });

  // QA 2026-11: флаг гас через 3 с, хотя запрос висел на сервере (повтор — no-op
  // дедупа), и терялся после перезагрузки.
  it('«отправлено» держится, пока открыт тот же клиент', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useYsqRequest(7, send));
    await act(() => result.current.handleRequestYsq());
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.ysqRequested).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('serverPending: висящий на сервере запрос виден без нажатия, reset его не гасит', () => {
    const send = vi.fn();
    const { result, rerender } = renderHook(
      ({ pending }: { pending: boolean }) => useYsqRequest(7, send, pending),
      { initialProps: { pending: true } },
    );
    expect(result.current.ysqRequested).toBe(true);
    act(() => result.current.resetYsq());
    expect(result.current.ysqRequested).toBe(true);
    rerender({ pending: false });
    expect(result.current.ysqRequested).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('нет клиента → ничего не отправляется', async () => {
    const send = vi.fn();
    const { result } = renderHook(() => useYsqRequest(null, send));
    await act(() => result.current.handleRequestYsq());
    expect(send).not.toHaveBeenCalled();
  });

  it('клиент с id 0 — валидный клиент, запрос уходит', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useYsqRequest(0, send));
    await act(() => result.current.handleRequestYsq());
    expect(send).toHaveBeenCalledWith(0);
  });

  it('resetYsq (смена клиента) гасит флаг и ошибку', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useYsqRequest(7, send));
    await act(() => result.current.handleRequestYsq());
    await act(() => result.current.handleRequestYsq());
    act(() => result.current.resetYsq());
    expect(result.current.ysqRequested).toBe(false);
    expect(result.current.ysqError).toBe('');
  });

  it('смена клиента при запросе в полёте: тап на новом уходит, поздний ответ прежнего игнорируется', async () => {
    const resolvers: Array<() => void> = [];
    const send = vi.fn(() => new Promise<void>((r) => resolvers.push(r)));
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useYsqRequest(id, send),
      { initialProps: { id: 1 } },
    );
    let first!: Promise<void>;
    act(() => {
      first = result.current.handleRequestYsq();
    });
    rerender({ id: 2 });
    let second!: Promise<void>;
    act(() => {
      second = result.current.handleRequestYsq();
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(2);
    await act(async () => {
      resolvers[0]();
      await first;
    });
    expect(result.current.ysqRequested).toBe(false);
    await act(async () => {
      resolvers[1]();
      await second;
    });
    expect(result.current.ysqRequested).toBe(true);
  });

  it('смена клиента: ошибка прежнего запроса не показывается на новом', async () => {
    let reject!: (e: Error) => void;
    const send = vi.fn(() => new Promise<void>((_, rej) => (reject = rej)));
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useYsqRequest(id, send),
      { initialProps: { id: 1 } },
    );
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleRequestYsq();
    });
    rerender({ id: 2 });
    await act(async () => {
      reject(new Error('fail'));
      await pending;
    });
    expect(result.current.ysqError).toBe('');
  });
});
