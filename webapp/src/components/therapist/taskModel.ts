import type { UserTask } from '../../../../shared/src/apiTypes';

export type TaskStatus = 'done' | 'overdue' | 'soon' | 'active';

/** «Скоро срок» — осталось не больше стольких дней. */
export const SOON_DAYS = 2;

const DAY_MS = 86_400_000;
const dayNum = (ymd: string) => Math.floor(Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`) / DAY_MS);

export function taskStatus(t: Pick<UserTask, 'done' | 'dueDate'>, today: string): TaskStatus {
  if (t.done === true) return 'done';
  if (!t.dueDate) return 'active';
  const left = dayNum(t.dueDate) - dayNum(today);
  if (left < 0) return 'overdue';
  return left <= SOON_DAYS ? 'soon' : 'active';
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  done: 'Выполнено',
  overdue: 'Просрочено',
  soon: 'Скоро срок',
  active: 'В работе',
};

export const STATUS_BADGE: Record<TaskStatus, string> = {
  done: 'ds-badge ds-badge--ok',
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
