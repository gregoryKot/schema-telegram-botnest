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

/**
 * Тихий ярлык статуса во вкладке «Задания» карточки клиента (b31, принцип 6): бумага, а не цветная таблетка.
 * Оттенки — как колонки доски терапевта (ENTITY_LOOK, «Кабинет терапевта»): ждёт клиента — солома 70,
 * «Выполнено» — шалфей 135, «Не вышло» — персик 45; «Просрочено» — роза 25 и жирнее: заметно без красной заливки,
 * «Скоро срок» — солома, но жирнее «В работе».
 */
export const STATUS_TAG: Record<TaskStatus, { hue: number; strong: boolean }> = {
  active: { hue: 70, strong: false },
  soon: { hue: 70, strong: true },
  overdue: { hue: 25, strong: true },
  done: { hue: 135, strong: false },
  failed: { hue: 45, strong: false },
};

/** Hue карточки шаблона по названию типа задания. */
export function templateHue(title: string): number {
  if (title.startsWith('Схема')) return 28;
  if (title.startsWith('Дневник')) return 310;
  if (title.startsWith('Письмо')) return 145;
  return 240;
}
