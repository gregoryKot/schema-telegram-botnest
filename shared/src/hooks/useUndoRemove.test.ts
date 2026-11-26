// @vitest-environment jsdom
// useUndoRemove — удаление строки с окном «Отменить»: строка уходит сразу,
// в окне возвращается на прежнее место, после окна отмены нет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useUndoRemove, UNDO_WINDOW_MS } from './useUndoRemove';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(initial = ['а', 'б', 'в']) {
  return renderHook(() => {
    const [list, setList] = useState(initial);
    return { list, setList, ...useUndoRemove(list, setList) };
  });
}

describe('useUndoRemove', () => {
  it('удаление убирает строку сразу и открывает окно отмены', () => {
    const { result } = setup();
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.remove(1));
    expect(result.current.list).toEqual(['а', 'в']);
    expect(result.current.canUndo).toBe(true);
  });

  it('«Отменить» в окне возвращает строку на прежнее место', () => {
    const { result } = setup();
    act(() => result.current.remove(1));
    act(() => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    });
    act(() => result.current.undo());
    expect(result.current.list).toEqual(['а', 'б', 'в']);
    expect(result.current.canUndo).toBe(false);
  });

  it('окно закрывается через 5 с — отменять нечего, список не меняется', () => {
    const { result } = setup();
    act(() => result.current.remove(0));
    act(() => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS);
    });
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.undo());
    expect(result.current.list).toEqual(['б', 'в']);
  });

  it('новое удаление закрывает окно прежнего: отмена вернёт только последнее', () => {
    const { result } = setup();
    act(() => result.current.remove(0)); // ушло «а»
    act(() => result.current.remove(1)); // ушло «в»
    act(() => result.current.undo());
    expect(result.current.list).toEqual(['б', 'в']);
  });

  it('окно второго удаления живёт полные 5 с, а не остаток первого', () => {
    const { result } = setup();
    act(() => result.current.remove(0));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => result.current.remove(0));
    act(() => {
      vi.advanceTimersByTime(3000);
    }); // первое окно уже истекло бы
    expect(result.current.canUndo).toBe(true);
    act(() => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS - 3000);
    });
    expect(result.current.canUndo).toBe(false);
  });

  it('строка, добавленная после удаления, не мешает вернуть удалённую на её место', () => {
    const { result } = setup(['а', 'б']);
    act(() => result.current.remove(0));
    act(() => result.current.setList((l) => [...l, 'г']));
    act(() => result.current.undo());
    expect(result.current.list).toEqual(['а', 'б', 'г']);
  });

  it('индекс вне списка — ничего не удаляет и окна не открывает', () => {
    const { result } = setup();
    act(() => result.current.remove(5));
    expect(result.current.list).toEqual(['а', 'б', 'в']);
    expect(result.current.canUndo).toBe(false);
  });
});
