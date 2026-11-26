// @vitest-environment jsdom
// Обвязка drag&drop листа «плюса»: хук перетаскивания считает индексы по ПЛОСКОМУ
// списку, а лист ждёт индекс внутри группы — конвертация global→local живёт здесь.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { useQuickActionDragRows } from './useQuickActionDragRows';
import { withDragRange } from './quickActionOrder';

const actions = withDragRange([
  [
    { id: 'a', label: 'А' },
    { id: 'b', label: 'Б' },
  ],
  [
    { id: 'c', label: 'В' },
    { id: 'd', label: 'Г' },
  ],
]);

function press(
  handle: { onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void },
  key: string,
) {
  handle.onKeyDown({
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent<HTMLDivElement>);
}

describe('useQuickActionDragRows', () => {
  it('стрелка вверх у второй группы отдаёт индекс внутри группы, а не в общем списке', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useQuickActionDragRows(actions, onReorder),
    );
    press(result.current.rowProps(actions[3]).dragHandleProps, 'ArrowUp');
    expect(onReorder).toHaveBeenCalledWith('d', 0);
  });

  it('первый пункт группы вверх не уходит за её границу', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useQuickActionDragRows(actions, onReorder),
    );
    press(result.current.rowProps(actions[2]).dragHandleProps, 'ArrowUp');
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('вниз в пределах группы — следующий индекс; подпись ручки называет пункт', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useQuickActionDragRows(actions, onReorder),
    );
    const { dragHandleProps } = result.current.rowProps(actions[0]);
    expect(dragHandleProps['aria-label']).toBe('Переставить: А');
    press(dragHandleProps, 'ArrowDown');
    expect(onReorder).toHaveBeenCalledWith('a', 1);
  });
});
