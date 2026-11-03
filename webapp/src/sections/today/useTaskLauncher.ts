import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { UserTask } from '../../api';
import { completesOnSave, taskRoute, type TaskExercise } from '../../../../shared/src/tasks/taskRoute';

// Запуск задания и упражнений поверх экрана — один на «Сегодня» и «Практику»
// (правило «одна механика — один компонент»). До 2026-10-26 у каждого экрана
// был свой switch по типу задания, и копия «Сегодня» отставала: упражнения
// открывали настройки, «Разобрать ситуацию по шагам» — ничего. Куда ведёт
// задание, решает shared/taskRoute; здесь — только состояние экрана.

/** Упражнение, открытое поверх экрана (рисует TaskExerciseHost). */
export type OpenExercise =
  | { ex: 'belief' | 'letter' | 'safe' | 'warm' | 'phrase' | 'flashcard' }
  | { ex: 'schema' | 'mode'; id?: string };

const EXERCISE_OF: Record<TaskExercise, OpenExercise['ex']> = {
  belief_check: 'belief',
  letter_to_self: 'letter',
  safe_place: 'safe',
  flashcard: 'flashcard',
};

export interface TaskLauncherDeps {
  onOpenDiaries: () => void;
  onOpenTracker: () => void;
  onOpenChildhoodWheel: () => void;
  /** Задание, открытое тапом, закрыто сохранением упражнения. */
  onTaskDone: (taskId: number) => void;
}

export function useTaskLauncher(deps: TaskLauncherDeps) {
  const [open, setOpen] = useState<OpenExercise | null>(null);
  // Задание, которое закроет сохранение открытого упражнения. Упражнение из
  // библиотеки и серии его сбрасывают: иначе карточка, сделанная позже «просто
  // так», закрыла бы давно открытое задание.
  const taskId = useRef<number | null>(null);
  // Свежие колбэки экрана без пересоздания openTask (рефы — в эффекте, не в
  // рендере: react-hooks/refs).
  const depsRef = useRef(deps);
  useLayoutEffect(() => { depsRef.current = deps; });

  const openExercise = useCallback((ex: OpenExercise) => {
    taskId.current = null;
    setOpen(ex);
  }, []);

  const openTask = useCallback((task: UserTask) => {
    const route = taskRoute(task);
    taskId.current = completesOnSave(route) ? task.id : null;
    const d = depsRef.current;
    switch (route.kind) {
      case 'diary': d.onOpenDiaries(); return;
      case 'tracker': d.onOpenTracker(); return;
      case 'childhood_wheel': d.onOpenChildhoodWheel(); return;
      case 'exercise': setOpen({ ex: EXERCISE_OF[route.exercise] }); return;
      case 'schema':
      case 'mode': setOpen({ ex: route.kind, id: route.id }); return;
      // «Своё задание» закрывается кнопкой «Готово», открывать нечего.
      default: return;
    }
  }, []);

  const close = useCallback(() => {
    taskId.current = null;
    setOpen(null);
  }, []);

  const complete = useCallback(() => {
    const id = taskId.current;
    if (id === null) return;
    taskId.current = null;
    depsRef.current.onTaskDone(id);
  }, []);

  return { open, openTask, openExercise, close, complete };
}
