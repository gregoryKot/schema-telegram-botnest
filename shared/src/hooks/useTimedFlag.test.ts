// @vitest-environment jsdom
// Флаг с автосбросом: включается по flash(), гаснет через ms, повторный flash
// перезапускает отсчёт, размонтирование гасит висящий таймер (иначе он стреляет
// после сноса jsdom — см. шапку useTimedFlag.ts).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimedFlag } from './useTimedFlag';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useTimedFlag', () => {
  it('flash включает флаг и гасит его через ms', () => {
    const { result } = renderHook(() => useTimedFlag(1000));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current[0]).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current[0]).toBe(false);
  });

  it('повторный flash перезапускает отсчёт', () => {
    const { result } = renderHook(() => useTimedFlag(1000));
    act(() => result.current[1]());
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => result.current[1]());
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current[0]).toBe(true);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current[0]).toBe(false);
  });

  it('flash стабилен между рендерами', () => {
    const { result, rerender } = renderHook(() => useTimedFlag(1000));
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });

  it('размонтирование гасит висящий таймер', () => {
    const { result, unmount } = renderHook(() => useTimedFlag(1000));
    act(() => result.current[1]());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
