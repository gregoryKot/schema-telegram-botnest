import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../../types';
import { diaryDayKey } from '../../../../shared/src/diary/diaryDay';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import type { TrackerDay } from './trackerEntries';

// Чистая модель экрана «Записи»: единый список (дневники + строки трекера),
// группировка по дням, счётчики сегмента «Все · Трекер · Случаи · Дневник».

export type AnyEntry =
  | { _type: 'schema'; sortKey: string; dateKey: string; entry: SchemaDiaryEntry }
  | { _type: 'mode'; sortKey: string; dateKey: string; entry: ModeDiaryEntry }
  | { _type: 'gratitude'; sortKey: string; dateKey: string; entry: GratitudeDiaryEntry }
  | { _type: 'tracker'; sortKey: string; dateKey: string; entry: TrackerDay };

export type DiaryFilter = 'all' | 'tracker' | 'case' | 'diary';

/** Запись режима, рождённая потоком «Что случилось» (маркер fromCase, этап 4 простого клиента). */
export const isCaseEntry = (e: AnyEntry): boolean => e._type === 'mode' && e.entry.fromCase === true;

/** Все записи одним списком, новые сверху; строка трекера идёт последней внутри своего дня. */
export function buildEntries(
  schema: SchemaDiaryEntry[],
  mode: ModeDiaryEntry[],
  gratitude: GratitudeDiaryEntry[],
  tracker: TrackerDay[] = [],
): AnyEntry[] {
  const all: AnyEntry[] = [
    ...schema.map((e) => ({ _type: 'schema' as const, sortKey: e.createdAt, dateKey: diaryDayKey(e.createdAt), entry: e })),
    ...mode.map((e) => ({ _type: 'mode' as const, sortKey: e.createdAt, dateKey: diaryDayKey(e.createdAt), entry: e })),
    ...gratitude.map((e) => ({ _type: 'gratitude' as const, sortKey: e.date + 'T12:00:00', dateKey: e.date, entry: e })),
    ...tracker.map((e) => ({ _type: 'tracker' as const, sortKey: e.date + 'T00:00:00', dateKey: e.date, entry: e })),
  ];
  return all.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

/** Ключ строки ленты: у строки трекера своего id нет — день один на строку. */
export const entryKey = (e: AnyEntry) => e._type + '-' + (e._type === 'tracker' ? e.dateKey : e.entry.id);

export function filterEntries(entries: AnyEntry[], filter: DiaryFilter): AnyEntry[] {
  if (filter === 'all') return entries;
  if (filter === 'tracker') return entries.filter((e) => e._type === 'tracker');
  if (filter === 'case') return entries.filter(isCaseEntry);
  return entries.filter((e) => e._type !== 'tracker' && !isCaseEntry(e));
}

/** Группы по дням в порядке следования записей (список уже отсортирован). */
export function groupByDay(entries: AnyEntry[]): { dateKey: string; items: AnyEntry[] }[] {
  const m = new Map<string, AnyEntry[]>();
  for (const e of entries) {
    const list = m.get(e.dateKey);
    if (list) list.push(e);
    else m.set(e.dateKey, [e]);
  }
  return Array.from(m, ([dateKey, items]) => ({ dateKey, items }));
}

export function filterCounts(entries: AnyEntry[]): Record<DiaryFilter, number> {
  const tracker = entries.filter((e) => e._type === 'tracker').length;
  const cases = entries.filter(isCaseEntry).length;
  return { all: entries.length, tracker, case: cases, diary: entries.length - tracker - cases };
}

/** Превью черновика — первое осмысленное поле по типу записи. */
export function draftPreview(type: DiaryType, data: unknown): string {
  const d = (data ?? {}) as Record<string, unknown>;
  const v = type === 'schema' ? d.trigger : type === 'mode' ? d.situation : Array.isArray(d.items) ? d.items[0] : '';
  return typeof v === 'string' ? v.slice(0, 100) : '';
}

/** «5 дней подряд. Сбиться — не страшно.»; серии нет — null (строки не будет). */
export function streakLine(streak: number): string | null {
  if (!(streak > 0)) return null;
  const word = pluralRu(streak, 'день', 'дня', 'дней');
  return `${streak} ${word} подряд. Сбиться — не страшно.`;
}
