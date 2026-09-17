// @vitest-environment jsdom
// Хук порядка: применяет order к группам, onReorder сохраняет перестановку
// СРЕДИ СОСЕДЕЙ СВОЕЙ ГРУППЫ (toIndex — локальный индекс внутри группы) и
// возвращает netto-направление 'up'/'down' для аналитики (read-after-write —
// новый рендер хука видит уже переставленный порядок).
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

  it('onReorder переставляет пункт на toIndex внутри его группы и перерисовывает hook, возвращает "up"', () => {
    const { result } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }]]),
    );
    let dir: 'up' | 'down' | false = false;
    act(() => {
      dir = result.current.onReorder('b', 0);
    });
    expect(dir).toBe('up');
    expect(result.current.ordered[0]).toEqual([{ id: 'b' }, { id: 'a' }]);
    expect(result.current.ordered[1]).toEqual([{ id: 'c' }]);
  });

  it('toIndex больше исходного — возвращает "down"', () => {
    const { result } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }, { id: 'b' }, { id: 'c' }]]),
    );
    let dir: 'up' | 'down' | false = false;
    act(() => {
      dir = result.current.onReorder('a', 2);
    });
    expect(dir).toBe('down');
    expect(result.current.ordered[0]).toEqual([
      { id: 'b' },
      { id: 'c' },
      { id: 'a' },
    ]);
  });

  it('toIndex === текущий индекс (единственный элемент группы) — false, ничего не меняется', () => {
    const { result } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }], [{ id: 'c' }]]),
    );
    let dir: 'up' | 'down' | false = 'up';
    act(() => {
      dir = result.current.onReorder('c', 0);
    });
    expect(dir).toBe(false);
    expect(result.current.ordered).toEqual([[{ id: 'a' }], [{ id: 'c' }]]);
  });

  it('id не найден ни в одной группе — false', () => {
    const { result } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }, { id: 'b' }]]),
    );
    let dir: 'up' | 'down' | false = 'up';
    act(() => {
      dir = result.current.onReorder('z', 0);
    });
    expect(dir).toBe(false);
  });

  it('read-after-write: новый рендер хука видит сохранённый порядок', () => {
    const { result, unmount } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }, { id: 'b' }, { id: 'c' }]]),
    );
    act(() => {
      result.current.onReorder('c', 0);
    });
    unmount();
    const { result: second } = renderHook(() =>
      useQuickActionOrder(KEY, [[{ id: 'a' }, { id: 'b' }, { id: 'c' }]]),
    );
    expect(second.current.ordered[0]).toEqual([
      { id: 'c' },
      { id: 'a' },
      { id: 'b' },
    ]);
  });
});
