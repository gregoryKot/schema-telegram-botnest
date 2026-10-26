import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../../types';
import { diaryDayKey } from '../../../../shared/src/diary/diaryDay';

// Чистая модель экрана «Дневник»: единый список записей, группировка по дням,
// статистика месяца, серия дней подряд, счётчики фильтра.

export type AnyEntry =
  | { _type: 'schema'; sortKey: string; dateKey: string; entry: SchemaDiaryEntry }
  | { _type: 'mode'; sortKey: string; dateKey: string; entry: ModeDiaryEntry }
  | { _type: 'gratitude'; sortKey: string; dateKey: string; entry: GratitudeDiaryEntry };

export type DiaryFilter = 'all' | DiaryType;

/** Все записи трёх типов одним списком, новые сверху. */
export function buildEntries(
  schema: SchemaDiaryEntry[],
  mode: ModeDiaryEntry[],
  gratitude: GratitudeDiaryEntry[],
): AnyEntry[] {
  const all: AnyEntry[] = [
    ...schema.map((e) => ({ _type: 'schema' as const, sortKey: e.createdAt, dateKey: diaryDayKey(e.createdAt), entry: e })),
    ...mode.map((e) => ({ _type: 'mode' as const, sortKey: e.createdAt, dateKey: diaryDayKey(e.createdAt), entry: e })),
    ...gratitude.map((e) => ({ _type: 'gratitude' as const, sortKey: e.date + 'T12:00:00', dateKey: e.date, entry: e })),
  ];
  return all.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

export function filterEntries(entries: AnyEntry[], filter: DiaryFilter): AnyEntry[] {
  return filter === 'all' ? entries : entries.filter((e) => e._type === filter);
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
  const c: Record<DiaryFilter, number> = { all: entries.length, schema: 0, mode: 0, gratitude: 0 };
  for (const e of entries) c[e._type]++;
  return c;
}

/** Дни месяца `today` (YYYY-MM-DD) с хотя бы одной записью / всего дней в месяце. */
export function monthStats(entries: AnyEntry[], today: string): { daysWithEntry: number; daysInMonth: number } {
  const month = today.slice(0, 7);
  const days = new Set(entries.map((e) => e.dateKey).filter((d) => d.startsWith(month)));
  const [y, m] = today.split('-').map(Number);
  return { daysWithEntry: days.size, daysInMonth: new Date(y, m, 0).getDate() };
}

/**
 * Серия дней подряд, заканчивающаяся сегодня; если сегодня записи ещё нет,
 * серия не рвётся — считается от вчера.
 */
export function streakDays(entries: AnyEntry[], today: string): number {
  const keys = new Set(entries.map((e) => e.dateKey));
  const d = new Date(today + 'T12:00:00Z');
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const key = d.toISOString().slice(0, 10);
    if (keys.has(key)) streak++;
    else if (i > 0) break;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

export function pluralEntries(n: number): string {
  return `${n} ${n === 1 ? 'запись' : n > 1 && n < 5 ? 'записи' : 'записей'}`;
}

/** Превью черновика — первое осмысленное поле по типу записи. */
export function draftPreview(type: DiaryType, data: unknown): string {
  const d = (data ?? {}) as Record<string, unknown>;
  const v = type === 'schema' ? d.trigger : type === 'mode' ? d.situation : Array.isArray(d.items) ? d.items[0] : '';
  return typeof v === 'string' ? v.slice(0, 100) : '';
}
