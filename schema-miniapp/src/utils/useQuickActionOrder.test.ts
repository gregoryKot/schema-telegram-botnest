// @vitest-environment jsdom
// Хук порядка: применяет order к группам, onMove свопает СРЕДИ СОСЕДЕЙ
// СВОЕЙ ГРУППЫ и обновляет state (read-after-write — новый рендер хука
// видит уже свопнутый порядок).
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useQuickActionOrder } from './useQuickActionOrder';

const KEY = 'quick_actions_order_test';

beforeEach(() => localStorage.clear());

describe('useQuickActionOrder', () => {
  it('без сохранённого порядка группы приходят в порядке реестра', () => {
    const { result } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }]]),
    );
    expect(result.current.ordered).toEqual([
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'c' }],
    ]);
  });

  it('onMove свопает пункт с соседом внутри его группы и перерисовывает hook', () => {
    const { result } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }]]),
    );
    let moved = false;
    act(() => {
      moved = result.current.onMove('b', 'up');
    });
    expect(moved).toBe(true);
    expect(result.current.ordered[0]).toEqual([{ id: 'b' }, { id: 'a' }]);
    expect(result.current.ordered[1]).toEqual([{ id: 'c' }]);
  });

  it('на краю группы (единственный элемент) — false, ничего не меняется', () => {
    const { result } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }], [{ id: 'c' }]]),
    );
    let moved = true;
    act(() => {
      moved = result.current.onMove('c', 'down');
    });
    expect(moved).toBe(false);
    expect(result.current.ordered).toEqual([[{ id: 'a' }], [{ id: 'c' }]]);
  });

  it('id не найден ни в одной группе — false', () => {
    const { result } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }, { id: 'b' }]]),
    );
    let moved = true;
    act(() => {
      moved = result.current.onMove('z', 'up');
    });
    expect(moved).toBe(false);
  });
});
