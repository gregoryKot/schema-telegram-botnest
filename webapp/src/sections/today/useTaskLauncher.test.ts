// @vitest-environment jsdom
// Запуск задания — общий для «Сегодня» и «Практики». Регрессия 2026-10-26
// (docs/INCIDENTS.md): «Сегодня» открывало настройки вместо упражнения.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskLauncher } from './useTaskLauncher';
import type { UserTask } from '../../api';

const task = (over: Partial<UserTask>): UserTask => ({
  id: 1, userId: 1, assignedBy: 9, type: 'custom', text: '', targetDays: null, needId: null,
  dueDate: null, done: null, completedAt: null, createdAt: '2026-10-01T00:00:00Z', ...over,
});

function setup() {
  const deps = { onOpenDiaries: vi.fn(), onOpenTracker: vi.fn(), onOpenChildhoodWheel: vi.fn(), onTaskDone: vi.fn() };
  const { result } = renderHook(() => useTaskLauncher(deps));
  return { deps, result };
}

describe('useTaskLauncher', () => {
  it('упражнение задания открывается, сохранение закрывает именно это задание', () => {
    const { deps, result } = setup();
    act(() => result.current.openTask(task({ id: 4, type: 'safe_place' })));
    expect(result.current.open).toEqual({ ex: 'safe' });
    act(() => result.current.complete());
    expect(deps.onTaskDone).toHaveBeenCalledWith(4);
    // Повторное сохранение на том же экране не закрывает задание второй раз.
    act(() => result.current.complete());
    expect(deps.onTaskDone).toHaveBeenCalledTimes(1);
  });

  it('карточки схемы и режима — с id из задания, «Разобрать по шагам» — поток flashcard', () => {
    const { result } = setup();
    act(() => result.current.openTask(task({ type: 'mode_intro', text: 'vulnerable_child' })));
    expect(result.current.open).toEqual({ ex: 'mode', id: 'vulnerable_child' });
    act(() => result.current.openTask(task({ type: 'flashcard', text: 'Разобрать сложную ситуацию по шагам' })));
    expect(result.current.open).toEqual({ ex: 'flashcard' });
  });

  it('серии уводят в дневник/трекер и не оставляют «висящее» задание', () => {
    const { deps, result } = setup();
    act(() => result.current.openTask(task({ id: 2, type: 'tracker_streak' })));
    expect(deps.onOpenTracker).toHaveBeenCalledTimes(1);
    act(() => result.current.openTask(task({ id: 3, type: 'diary_streak' })));
    expect(deps.onOpenDiaries).toHaveBeenCalledTimes(1);
    act(() => result.current.complete());
    expect(deps.onTaskDone).not.toHaveBeenCalled();
    expect(result.current.open).toBeNull();
  });

  it('упражнение из библиотеки и «Назад» задание не закрывают', () => {
    const { deps, result } = setup();
    act(() => result.current.openTask(task({ id: 5, type: 'belief_check' })));
    act(() => result.current.close());
    expect(result.current.open).toBeNull();
    act(() => result.current.openExercise({ ex: 'belief' }));
    act(() => result.current.complete());
    expect(deps.onTaskDone).not.toHaveBeenCalled();
  });

  it('«Своё задание» ничего не открывает: его закрывает «Готово»', () => {
    const { deps, result } = setup();
    act(() => result.current.openTask(task({ type: 'custom', text: 'Позвонить маме' })));
    expect(result.current.open).toBeNull();
    expect(deps.onOpenDiaries).not.toHaveBeenCalled();
  });
});
