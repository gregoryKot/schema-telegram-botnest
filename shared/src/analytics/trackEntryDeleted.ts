// Событие «удалил свою запись» (entry_deleted, правило №8) — одно на все
// экраны удаления (правило №3): «Мой путь», разбор фразы, записи дневника.
// Записи несут очень личный текст — /stats показывает, находят ли удаление.
import { ENTRY_DELETED_EVENT, type EntryDeleteType } from '../share/analytics';

export interface EntryDeletedTracker {
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

/** Шлётся после успешного DELETE. fire-and-forget: сбой трекинга не
 *  превращает уже прошедшее удаление в неудачу. */
export function trackEntryDeleted(
  api: EntryDeletedTracker,
  type: EntryDeleteType,
): void {
  try {
    api.trackEvent(ENTRY_DELETED_EVENT, { type });
  } catch {
    // удаление уже прошло — событие не должно его отменять
  }
}
