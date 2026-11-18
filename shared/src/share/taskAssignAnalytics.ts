// Аналитика листа «Новое задание» в кабинете терапевта (правило №8): откуда взято назначенное
// задание. Парный allow-list — src/analytics/cabinet-events.constants.ts, строка в /stats —
// src/bot/task-assign-metrics.*. Текст задания и клиент в событие не попадают (правило №7).
// Имя в trackEvent — строковым литералом: так его видит трипваер analytics-sync.
export const TASK_ASSIGN_SOURCE_EVENT = 'task_assign_source';

/** tile — упражнение приложения плиткой, catalog — «Взять» из справочника, custom — свой текст. */
export type TaskAssignSource = 'tile' | 'catalog' | 'custom';

export function taskAssignSource(
  type: string,
  fromCatalog: boolean,
): TaskAssignSource {
  if (type !== 'custom') return 'tile';
  return fromCatalog ? 'catalog' : 'custom';
}

interface Tracker {
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

/** Терапевт назначил задание клиенту. */
export function trackTaskAssignSource(
  api: Tracker,
  source: TaskAssignSource,
): void {
  api.trackEvent('task_assign_source', { source });
}
