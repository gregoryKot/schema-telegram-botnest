// День ленты «Записей» и сводка недели (docs/design/APP_2026-11.md, b11-diary-feed). Трекер — не
// карточка в каждом дне (~40% высоты ленты при одной цифре), а полоски дня в строке даты (DayHead):
// splitDay отделяет его от записей. Сводка «Эта неделя» справа от ленты на компьютере — только
// реальные данные: счёт по типам за семь местных дней и только когда загруженное покрывает неделю
// (иначе часть записей ещё на сервере, и цифра была бы меньше правды — сводки нет).
import { calendarDaysAgo } from '../../../../shared/src/utils/calendarAgo';
import { shiftCalendarDay } from '../../../../shared/src/utils/calendarDate';
import { diaryDayKey } from '../../../../shared/src/diary/diaryDay';
import type { EntryKind } from './entryKind';
import type { AnyEntry, DiaryFilter } from './diaryModel';
import type { TrackerDay } from './trackerEntries';
import { entryKindOf } from './feedLook';

export type DayEntry = Exclude<AnyEntry, { _type: 'tracker' }>;

/** Трекер дня (строка даты) и записи дня (карточки) — по отдельности. */
export function splitDay(items: AnyEntry[]): { tracker: TrackerDay | null; entries: DayEntry[] } {
  let tracker: TrackerDay | null = null;
  const entries: DayEntry[] = [];
  for (const item of items) {
    if (item._type === 'tracker') tracker = item.entry;
    else entries.push(item);
  }
  return { tracker, entries };
}

/** Порядок строк сводки: как сегмент ленты — дневник, разбор, трекер. */
export const WEEK_ORDER: readonly EntryKind[] = ['schema', 'thought', 'mode', 'gratitude', 'case', 'tracker'];
export const WEEK_DAYS = 7;

export interface WeekRow { kind: EntryKind; count: number }

/** Первый день недели сводки: сегодня и шесть дней до него. */
export const weekStart = (today: string): string => shiftCalendarDay(today, -(WEEK_DAYS - 1));

/** Список загружен на всю неделю: страниц больше нет или самая старая запись старше недели. */
export function listCoversWeek(oldestDay: string | undefined, more: boolean, today: string): boolean {
  return !more || (oldestDay !== undefined && oldestDay < weekStart(today));
}

/** Счёт записей недели по типам; типы без записей не показываются, пустая неделя — пустой список. */
export function weekRows(entries: AnyEntry[], today: string): WeekRow[] {
  const counts = new Map<EntryKind, number>();
  for (const e of entries) {
    const ago = calendarDaysAgo(e.dateKey, today);
    if (!(ago >= 0 && ago < WEEK_DAYS)) continue; // будущее, старше недели и битая дата — мимо
    const kind = entryKindOf(e);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return WEEK_ORDER.filter((k) => counts.has(k)).map((kind) => ({ kind, count: counts.get(kind)! }));
}

/** Загруженные списки дневников: самые старые записи в хвосте, `more` — есть ли страницы старше. */
export interface LoadedLists {
  schema: { createdAt: string }[]; mode: { createdAt: string }[]; gratitude: { date: string }[];
  more: Record<'schema' | 'mode' | 'gratitude', boolean>;
}

/** Сводка недели ленты: пусто, пока хоть один дневник не загружен на всю неделю (цифра была бы меньше правды). */
export function diaryWeek(entries: AnyEntry[], lists: LoadedLists, today: string): WeekRow[] {
  const s = lists.schema.at(-1), m = lists.mode.at(-1), g = lists.gratitude.at(-1);
  const covered = listCoversWeek(s && diaryDayKey(s.createdAt), lists.more.schema, today)
    && listCoversWeek(m && diaryDayKey(m.createdAt), lists.more.mode, today)
    && listCoversWeek(g?.date, lists.more.gratitude, today);
  return covered ? weekRows(entries, today) : [];
}

/** Счётчики сегмента: пока лента не загружена (загрузка, сбой) — нет чисел, «0» читался бы «записей нет»;
 *  сбой истории трекера — без числа у «Трекера» по той же причине. */
export function segCounts(
  counts: Record<DiaryFilter, number>, s: { loading: boolean; loadFailed: boolean; trackerFailed: boolean },
): Record<DiaryFilter, number | null> | null {
  if (s.loading || s.loadFailed) return null;
  return s.trackerFailed ? { ...counts, tracker: null } : counts;
}
