// @vitest-environment jsdom
// Хук скрытия: обёртка state + persist над quickActionPrefs.ts. Тестируем
// именно связку toggle → localStorage → следующий рендер хука видит
// сохранённое (read-after-write), не только факт вызова сеттера.
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHiddenActions } from './useHiddenActions';

const KEY = 'quick_actions_hidden_test';

beforeEach(() => localStorage.clear());

describe('useHiddenActions', () => {
  it('по умолчанию ничего не скрыто', () => {
    const { result } = renderHook(() => useHiddenActions(KEY));
    expect(result.current[0]).toEqual([]);
  });

  it('toggle(id, true) скрывает пункт и сохраняет его в localStorage', () => {
    const { result } = renderHook(() => useHiddenActions(KEY));
    act(() => result.current[1]('tracker', true));
    expect(result.current[0]).toEqual(['tracker']);
    expect(localStorage.getItem(KEY)).toBe('["tracker"]');
  });

  it('toggle(id, false) возвращает пункт', () => {
    const { result } = renderHook(() => useHiddenActions(KEY));
    act(() => result.current[1]('tracker', true));
    act(() => result.current[1]('tracker', false));
    expect(result.current[0]).toEqual([]);
  });

  it('новый рендер хука видит сохранённое состояние (read-after-write)', () => {
    const { result, rerender } = renderHook(() => useHiddenActions(KEY));
    act(() => result.current[1]('warm_words', true));
    rerender();
    expect(result.current[0]).toEqual(['warm_words']);
  });
});
