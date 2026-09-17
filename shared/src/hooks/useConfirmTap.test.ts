// @vitest-environment jsdom
// Двухтапное подтверждение удаления: первый тап не вызывает action, второй —
// вызывает; по таймауту или тапу на другую строку состояние сбрасывается.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfirmTap } from './useConfirmTap';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useConfirmTap', () => {
  it('первый тап не вызывает action и переводит строку в pending', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap<number>(action));
    act(() => result.current.tap(1));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.isPending(1)).toBe(true);
  });

  it('второй тап по той же строке в окне подтверждения вызывает action и сбрасывает pending', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap<number>(action));
    act(() => result.current.tap(1));
    act(() => result.current.tap(1));
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(1);
    expect(result.current.isPending(1)).toBe(false);
  });

  it('по таймауту pending сбрасывается без вызова action', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap<number>(action));
    act(() => result.current.tap(1));
    void act(() => vi.advanceTimersByTime(3000));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.isPending(1)).toBe(false);
  });

  it('тап по другой строке переносит pending на неё, не вызывая action ни для одной', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap<number>(action));
    act(() => result.current.tap(1));
    act(() => result.current.tap(2));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.isPending(1)).toBe(false);
    expect(result.current.isPending(2)).toBe(true);
  });

  it('повторный тап после уже сработавшего окна снова требует двух тапов', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap<number>(action));
    act(() => result.current.tap(1));
    act(() => result.current.tap(1));
    expect(action).toHaveBeenCalledTimes(1);
    act(() => result.current.tap(1));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isPending(1)).toBe(true);
  });

  it('поддерживает свой timeoutMs', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap<number>(action, 1000));
    act(() => result.current.tap(1));
    void act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isPending(1)).toBe(false);
  });
});
