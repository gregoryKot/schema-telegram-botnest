// Склейка страниц «Записей» (хвост R6, аудит 2026-11). Догруженная страница
// вставала в хвост списка, а перезагрузка после сохранения из быстрой записи
// (applyFirst) заменяла список первой страницей — «Показать ещё» приходилось
// жать заново. Здесь порядок держится по дате (как у сервера, src/bot/diary-page.ts:
// новые сверху, при равном моменте — больший id выше), а перезагрузка первой
// страницы заменяет только свой диапазон и оставляет догруженное старше него.
import type { DiaryPage } from '../../../../shared/src/api/entryApi';

type Row = { id: number };
/** Ключ порядка: момент записи у схем и режимов, день — у благодарностей. */
export type SortKey<T> = (row: T) => string;

/** Сравнение «новые сверху»; > 0 — `a` старше `b`. */
export function byNewest<T extends Row>(key: SortKey<T>) {
  return (a: T, b: T): number => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) return ka < kb ? 1 : -1;
    return b.id - a.id;
  };
}

/** Страница встаёт по дате; запись, уже стоящая в списке, не дублируется (свежая копия побеждает). */
export function mergePage<T extends Row>(rows: T[], page: T[], key: SortKey<T>): T[] {
  const fresh = new Set(page.map((r) => r.id));
  return [...rows.filter((r) => !fresh.has(r.id)), ...page].sort(byNewest(key));
}

/**
 * Первая страница заново (после сохранения, повтора загрузки): её диапазон
 * берётся из ответа, записи старше её последней — из уже показанного списка.
 * `more` — есть ли на сервере записи старше самой старой в списке.
 */
export function refreshFirstPage<T extends Row>(
  rows: T[], more: boolean, page: DiaryPage<T>, key: SortKey<T>,
): { rows: T[]; more: boolean } {
  const last = page.items[page.items.length - 1];
  if (!page.hasMore || !last) return { rows: page.items, more: false };
  const older = rows.filter((r) => byNewest(key)(r, last) > 0);
  return { rows: mergePage(older, page.items, key), more: older.length > 0 ? more : true };
}
