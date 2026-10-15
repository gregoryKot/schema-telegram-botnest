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

  it('ysqRequested гаснет через 3 с', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useYsqRequest(7, send));
    await act(() => result.current.handleRequestYsq());
    expect(result.current.ysqRequested).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.ysqRequested).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.ysqRequested).toBe(false);
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

  it('resetYsq гасит флаг, ошибку и висящий таймер', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useYsqRequest(7, send));
    await act(() => result.current.handleRequestYsq());
    act(() => result.current.resetYsq());
    expect(result.current.ysqRequested).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('размонтирование гасит таймер', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useYsqRequest(7, send));
    await act(() => result.current.handleRequestYsq());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
