// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSaveFailure } from './useSaveFailure';

describe('useSaveFailure', () => {
  it('отказ записи поднимает флаг и зовёт onFail, успех следующей записи снимает', async () => {
    const { result } = renderHook(() => useSaveFailure());
    const onFail = vi.fn();
    await act(async () => { result.current.track(Promise.reject(new Error('x')), onFail); });
    expect(result.current.failed).toBe(true);
    expect(onFail).toHaveBeenCalledTimes(1);
    await act(async () => { result.current.track(Promise.resolve()); });
    expect(result.current.failed).toBe(false);
  });

  it('устаревший отказ не перебивает более новую успешную запись', async () => {
    const { result } = renderHook(() => useSaveFailure());
    let rejectOld: (e: Error) => void = () => {};
    const old = new Promise((_, rej) => { rejectOld = rej; });
    await act(async () => {
      result.current.track(old);
      result.current.track(Promise.resolve());
    });
    await act(async () => { rejectOld(new Error('late')); });
    expect(result.current.failed).toBe(false);
  });

  it('error — причина последнего отказа; успех её снимает', async () => {
    const { result } = renderHook(() => useSaveFailure());
    const conflict = Object.assign(new Error('409'), { status: 409 });
    expect(result.current.error).toBeUndefined();
    await act(async () => { result.current.track(Promise.reject(conflict)); });
    expect(result.current.error).toBe(conflict);
    await act(async () => { result.current.track(Promise.resolve()); });
    expect(result.current.error).toBeUndefined();
  });

  it('clear сбрасывает флаг', async () => {
    const { result } = renderHook(() => useSaveFailure());
    await act(async () => { result.current.track(Promise.reject(new Error('x'))); });
    act(() => result.current.clear());
    expect(result.current.failed).toBe(false);
  });
});
