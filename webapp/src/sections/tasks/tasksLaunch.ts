import { useCallback, useEffect, useState } from 'react';
import type { UserTask } from '../../api';
import { taskRoute, type TaskRoute } from '../../../../shared/src/tasks/taskRoute';

// «Открыть «Задания»» снаружи «Ещё»: ссылка запуска `tasks`/`tasks_<id>` из
// уведомления «Терапевт назначил задание» (useStartParam → EntryFlows). Запрос
// живёт в модуле, а не в состоянии роутера: «Ещё» может смонтироваться позже
// запроса (переход на /more идёт тем же тактом) или уже стоять на экране —
// в обоих случаях он забирает запрос ровно один раз.

export interface TasksOpen {
  /** Задание, которое открыть сразу; нет — только список. */
  taskId?: number;
}

let pending: TasksOpen | null = null;
const listeners = new Set<() => void>();

/** Попросить «Ещё» открыть «Задания» (и задание taskId, если оно есть). */
export function requestTasksOpen(taskId?: number): void {
  pending = taskId === undefined ? {} : { taskId };
  listeners.forEach((l) => l());
}

function takeRequest(): TasksOpen | null {
  const p = pending;
  pending = null;
  return p;
}

/** Состояние листа «Задания» в «Ещё»: открыт ли, с каким заданием; запросы снаружи открывают его. */
export function useTasksSheet() {
  const [open, setOpen] = useState<TasksOpen | null>(null);
  useEffect(() => {
    const onRequest = () => {
      const req = takeRequest();
      if (req) setOpen(req);
    };
    listeners.add(onRequest);
    onRequest(); // запрос пришёл до монтирования
    return () => { listeners.delete(onRequest); };
  }, []);
  const show = useCallback(() => setOpen({}), []);
  const hide = useCallback(() => setOpen(null), []);
  return { open: open !== null, taskId: open?.taskId, show, hide };
}

// Лист поверх «Заданий» (TaskExerciseHost) — у упражнений, карточек схем и
// режимов и теста. Дневник, трекер и «колесо» открываются вне узла, «Своё
// задание» открывать нечем: по ссылке на них человек видит список, а в нём
// это задание с кнопкой «начать».
const SHEET_ROUTES: ReadonlySet<TaskRoute['kind']> = new Set(['exercise', 'schema', 'mode', 'ysq'] as const);

/** Задание из ссылки, которое открыть сразу листом; null — показать список. */
export function taskToOpen(tasks: readonly UserTask[], taskId: number): UserTask | null {
  const task = tasks.find(t => t.id === taskId);
  return task && SHEET_ROUTES.has(taskRoute(task).kind) ? task : null;
}
