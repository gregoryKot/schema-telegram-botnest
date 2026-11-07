import type { TaskStatus } from '../../../../shared/src/tasks/taskStatus';

// Модель статусов задания — общая с мини-аппом (shared/src/tasks/taskStatus.ts);
// здесь только то, что есть у сайта: классы бейджей и цвет шаблонов.
export {
  SOON_DAYS, STATUS_LABEL, isOpenStatus, orderTasks, taskMeta, taskStatus, type TaskStatus,
} from '../../../../shared/src/tasks/taskStatus';

export const STATUS_BADGE: Record<TaskStatus, string> = {
  done: 'ds-badge ds-badge--ok',
  failed: 'ds-badge ds-badge--line',
  overdue: 'ds-badge ds-badge--warn',
  soon: 'ds-badge ds-badge--warn',
  active: 'ds-badge',
};

/** Hue карточки шаблона по названию типа задания. */
export function templateHue(title: string): number {
  if (title.startsWith('Схема')) return 28;
  if (title.startsWith('Дневник')) return 310;
  if (title.startsWith('Письмо')) return 145;
  return 240;
}
