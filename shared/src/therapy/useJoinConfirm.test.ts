// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJoinConfirm } from './useJoinConfirm';

const tr = (ty: string) => ty;

describe('useJoinConfirm', () => {
  it('без confirm() join не зовётся', () => {
    const join = vi.fn();
    renderHook(() => useJoinConfirm(true, tr, join, vi.fn()));
    expect(join).not.toHaveBeenCalled();
  });

  it('успех: один join, затем onDone', async () => {
    const join = vi.fn().mockResolvedValue(undefined);
    const onDone = vi.fn();
    const { result } = renderHook(() => useJoinConfirm(true, tr, join, onDone));
    await act(async () => {
      await result.current.confirm();
    });
    expect(join).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.failMsg).toBe('');
  });

  // Инцидент 2026-10-26: после подключения к терапевту окно молча
  // закрывалось — теперь экран знает, что всё прошло, и говорит об этом.
  it('успех: done = true, busy снят; до успеха done = false', async () => {
    const join = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useJoinConfirm(false, tr, join, vi.fn()),
    );
    expect(result.current.done).toBe(false);
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.done).toBe(true);
    expect(result.current.busy).toBe(false);
  });

  it('409 терапевта: свой текст, busy снят, onDone не зван', async () => {
    const join = vi
      .fn()
      .mockRejectedValue({ status: 409, reason: 'already_connected' });
    const onDone = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useJoinConfirm(false, tr, join, onDone, onError),
    );
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.failMsg).toMatch(/уже есть подключение/);
    expect(result.current.busy).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.done).toBe(false);
  });

  it('прочая ошибка: общий текст', async () => {
    const join = vi.fn().mockRejectedValue(new Error('x'));
    const { result } = renderHook(() =>
      useJoinConfirm(true, tr, join, vi.fn()),
    );
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.failMsg).toMatch(/Не получилось присоединиться/);
  });
});
