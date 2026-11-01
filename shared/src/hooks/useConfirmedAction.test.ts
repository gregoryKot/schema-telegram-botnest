// @vitest-environment jsdom
// Действие за подтверждением (отключение от терапевта — до 2026-10-26 одним
// тапом; удаление результатов теста): без «да» действия нет, отказ оставляет
// подтверждение открытым с ошибкой.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfirmedAction } from './useConfirmedAction';

describe('useConfirmedAction', () => {
  it('ask только открывает подтверждение — действие не зовётся', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmedAction(action, vi.fn()));
    act(() => result.current.ask());
    expect(result.current.confirming).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it('cancel закрывает без действия', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmedAction(action, vi.fn()));
    act(() => result.current.ask());
    act(() => result.current.cancel());
    expect(result.current.confirming).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('confirm: действие → подтверждение закрыто → onDone', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const onDone = vi.fn();
    const { result } = renderHook(() => useConfirmedAction(action, onDone));
    act(() => result.current.ask());
    await act(() => result.current.confirm());
    expect(action).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.confirming).toBe(false);
    expect(result.current.busy).toBe(false);
  });

  it('отказ: подтверждение остаётся открытым с ошибкой, onDone не зван', async () => {
    const onDone = vi.fn();
    const { result } = renderHook(() =>
      useConfirmedAction(() => Promise.reject(new Error('net')), onDone),
    );
    act(() => result.current.ask());
    await act(() => result.current.confirm());
    expect(result.current.failed).toBe(true);
    expect(result.current.confirming).toBe(true);
    expect(onDone).not.toHaveBeenCalled();
    act(() => result.current.ask());
    expect(result.current.failed).toBe(false);
  });
});
