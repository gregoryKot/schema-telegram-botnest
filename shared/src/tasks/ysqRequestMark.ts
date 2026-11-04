import { useCallback, useEffect, useState } from 'react';
import type { UserTask } from '../apiTypes';
import { useTasksChanged } from './tasksChanged';

// Пометка «терапевт просит пройти тест» у входа в тест на схемы — на обеих
// площадках (QA 2026-11, К1). Запрос терапевта — задание `ysq_test`
// (src/therapy/ysq-request.ts), и его видно в блоке «От терапевта», но в
// мини-аппе этот блок живёт в «Помощи», а не на «Сегодня»: у самого теста о
// запросе не было ни слова. Пометка снимается вместе с заданием — его
// закрывает сохранённый тест, сигнал tasks-changed перечитывает список.

/** UserTask.type запроса терапевта; сверка с бэкендом —
 *  src/therapy/ysq-task-type.parity.spec.ts (правило №4). */
export const YSQ_TASK_TYPE = 'ysq_test';

/** Есть открытое задание «пройти тест» от терапевта. */
export function hasOpenYsqRequest(
  tasks: Pick<UserTask, 'type' | 'assignedBy' | 'done'>[],
): boolean {
  return tasks.some(
    (t) => t.type === YSQ_TASK_TYPE && t.assignedBy !== null && t.done === null,
  );
}

/** Подпись под входом в тест: запрос терапевта — первым делом. */
export function ysqEntrySub(o: {
  hasResult: boolean;
  requested: boolean;
}): string {
  if (o.requested)
    return o.hasResult
      ? 'Терапевт просит пройти заново'
      : 'Терапевт просит пройти · 116 вопросов, ~10 минут';
  return o.hasResult
    ? 'Посмотреть или пройти заново'
    : '116 вопросов · ~10 минут';
}

/** Висит ли запрос терапевта. Сбой загрузки — пометки нет (не выдумываем). */
export function useYsqRequested(getTasks: () => Promise<UserTask[]>): boolean {
  const [requested, setRequested] = useState(false);
  const load = useCallback(() => {
    // Синхронный сбой вызова — тот же путь, что отказ сети.
    Promise.resolve()
      .then(getTasks)
      .then((tasks) => setRequested(hasOpenYsqRequest(tasks)))
      .catch(() => setRequested(false));
  }, [getTasks]);
  useEffect(load, [load]);
  useTasksChanged(load);
  return requested;
}
