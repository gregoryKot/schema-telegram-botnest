// Название задания для уведомления клиенту в боте. Баг 2026-11-05: терапевт
// назначал карточку схемы, а бот писал «Терапевт назначил задание:
// emotional_deprivation» — в text лежит id, а названия жили только во фронте.
// Зеркало shared/src/tasks/taskTitle.ts (getTaskDisplayText + legacy-ветка
// findLegacyTaskTarget, вариант 'full'); данные — task-title.data.ts.
import { MODE_NAMES, SCHEMA_NAMES } from './task-title.data';

/** Что контроллер отдаёт в уведомление «терапевт назначил задание». */
export interface TaskNotificationInput {
  type: string;
  text: string;
  needId: string | null;
  dueDate: string | null;
  /** id задания: кнопка уведомления открывает его (`?startapp=tasks_<id>`, U2). */
  taskId?: number;
}

const own = (map: Record<string, string>, id: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(map, id) ? map[id] : undefined;

export function taskNotificationTitle(type: string, text: string): string {
  if (type === 'schema_intro') {
    const name = own(SCHEMA_NAMES, text);
    return name ? `Карточка схемы: ${name}` : 'Карточка схемы';
  }
  if (type === 'mode_intro') {
    const name = own(MODE_NAMES, text);
    return name ? `Карточка режима: ${name}` : 'Карточка режима';
  }
  // Задания старого формата хранили id схемы/режима прямо в text.
  const schema = own(SCHEMA_NAMES, text);
  if (schema) return `Карточка схемы: ${schema}`;
  const mode = own(MODE_NAMES, text);
  if (mode) return `Карточка режима: ${mode}`;
  return text;
}
