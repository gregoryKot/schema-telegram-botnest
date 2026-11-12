// Вид строки задания и группы полного списка (b20, docs/design/APP_2026-11.md): чистая логика под тестом
// (TaskRow.test.tsx). Сущность задания (знак) — taskEntity.ts: без рантайм-импорта entityLook здесь, его тянут
// модули главного потока (сведение g6). Действия строки — taskRowState.ts.
import type { UserTask } from '../../api';
import type { TaskStatus } from '../../../../shared/src/tasks/taskStatus';

/** Статус в строке — только тот, что просит внимания: «В работе» у каждой строки шумел, «Выполнено» несёт группа. */
export const rowStatus = (status: TaskStatus | undefined): TaskStatus | null =>
  status === 'soon' || status === 'overdue' ? status : null;

/** Серия до двух недель — штрихами по дню (как полоски Strokes), длиннее — сплошной полосой: 30 штрихов не читаются. */
export const SEGMENTED_MAX = 14;
export function progressSegments(progress: number, target: number): boolean[] | null {
  if (target <= 0 || target > SEGMENTED_MAX) return null;
  return Array.from({ length: target }, (_, i) => i < progress);
}

export interface TaskGroups {
  therapist: UserTask[];
  mine: UserTask[];
  done: UserTask[];
}

/** Группы полного списка: «От терапевта», «Мои цели», «Выполнено» (как блоки «Практик»). */
export function groupTasks(tasks: readonly UserTask[], history: readonly UserTask[]): TaskGroups {
  return {
    therapist: tasks.filter((t) => t.assignedBy !== null),
    mine: tasks.filter((t) => t.assignedBy === null),
    done: [...history],
  };
}
