// Аналитика листа «Новое задание» в кабинете терапевта (правило №8): откуда взято назначенное
// задание. Парный allow-list — src/analytics/cabinet-events.constants.ts, строка в /stats —
// src/bot/task-assign-metrics.*. Текст задания и клиент в событие не попадают (правило №7).
// Имя в trackEvent — строковым литералом: так его видит трипваер analytics-sync.
export const TASK_ASSIGN_SOURCE_EVENT = 'task_assign_source';

/**
 * tile — упражнение приложения плиткой, catalog — «Взять» из справочника, custom — свой текст,
 * guide — «Дать заданием» из листа справочника, template — плитка «Назначить из шаблона».
 * Список сверяется с бэкендом тестом src/security/analytics-sync.invariants.spec.ts.
 */
// prettier-ignore
export const TASK_ASSIGN_SOURCES = ['tile', 'catalog', 'custom', 'guide', 'template'] as const;
export type TaskAssignSource = (typeof TASK_ASSIGN_SOURCES)[number];

/** Откуда лист открыт уже с заготовкой. */
export type TaskAssignOrigin = 'guide' | 'template';

/** `opened` — с чем лист открыт: его источник считается, пока терапевт не сменил тип задания. */
export function taskAssignSource(
  type: string,
  fromCatalog: boolean,
  opened?: { origin?: TaskAssignOrigin; type?: string },
): TaskAssignSource {
  if (opened?.origin && opened.type === type) return opened.origin;
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
