// Название задания одной строкой — строка списка заданий (TaskRowTitle) и общий поиск (ownRows.ts).
import type { UserTask } from '../../api';
import { catalogTaskParts, taskWhy, type WhyTr } from '../../../../shared/src/tasks/catalog/taskWhy';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';

/** Задание из справочника — первая строка его текста; остальные — название по типу, без префикса. */
export function taskTitleText(task: Pick<UserTask, 'type' | 'text' | 'catalogId'>, tr: WhyTr): string {
  return taskWhy(task.catalogId, tr) ? catalogTaskParts(task.text).title : resolveTaskDisplayText(task, 'compact');
}
