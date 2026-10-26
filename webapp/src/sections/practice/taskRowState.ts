import type { UserTask } from '../../api';
import { taskRoute } from '../../../../shared/src/tasks/taskRoute';

const STREAK_TYPES = ['diary_streak', 'tracker_streak'];

/**
 * Какие действия у строки задания (как FullTaskRow в мини-аппе): чистая
 * логика, под тестом. Общая для «Практики» (TaskRow) и «Сегодня»
 * (PracticesBlock); куда ведёт задание, решает shared/taskRoute.
 */
export function taskRowState(task: UserTask, hasComplete: boolean) {
  const doneToday = !!task.doneToday;
  const kind = taskRoute(task).kind;
  // Тап открывает упражнение, пока задание не сделано сегодня. «Своё задание»
  // открыть некуда: у него вместо стрелки кнопка «Готово» (раньше строка
  // выглядела нажимаемой и не делала ничего, QA 2026-10-26).
  const openable = !doneToday && kind !== 'self' && kind !== 'none';
  return {
    doneToday,
    showComplete: !doneToday && task.done === null && kind === 'self' && hasComplete,
    openable,
    showCta: openable,
    streakNote: doneToday && STREAK_TYPES.includes(task.type),
  };
}
