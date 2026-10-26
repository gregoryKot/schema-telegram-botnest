import { describe, it, expect } from 'vitest';
import {
  buildEntries, filterEntries, groupByDay, filterCounts, monthStats, streakDays, pluralEntries,
} from './diaryModel';
import { withTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

const s = (id: number, createdAt: string) => ({ id, createdAt, trigger: 't', emotions: [], schemaIds: [] });
const m = (id: number, createdAt: string) => ({ id, createdAt, modeId: 'x', situation: 's' });
const g = (id: number, date: string) => ({ id, date, items: ['a'], createdAt: date + 'T20:00:00Z' });

describe('diaryModel', () => {
  const entries = buildEntries(
    [s(1, '2026-10-15T09:00:00Z'), s(2, '2026-10-13T09:00:00Z')],
    [m(1, '2026-10-15T12:00:00Z')], // полдень UTC: тот же день и в Сиднее, и в Лос-Анджелесе
    [g(1, '2026-10-14')],
  );

  it('сортирует новые сверху', () => {
    expect(entries.map((e) => e.dateKey)).toEqual(['2026-10-15', '2026-10-15', '2026-10-14', '2026-10-13']);
    expect(entries[0]._type).toBe('mode');
  });

  it('группирует по дням и фильтрует по типу', () => {
    const groups = groupByDay(entries);
    expect(groups.map((x) => [x.dateKey, x.items.length])).toEqual([
      ['2026-10-15', 2], ['2026-10-14', 1], ['2026-10-13', 1],
    ]);
    expect(groupByDay(filterEntries(entries, 'schema')).length).toBe(2);
    expect(filterEntries(entries, 'all').length).toBe(4);
  });

  it('считает счётчики фильтра', () => {
    expect(filterCounts(entries)).toEqual({ all: 4, schema: 2, mode: 1, gratitude: 1 });
  });

  it('статистика месяца: уникальные дни и длина месяца', () => {
    expect(monthStats(entries, '2026-10-15')).toEqual({ daysWithEntry: 3, daysInMonth: 31 });
    expect(monthStats(entries, '2026-11-02')).toEqual({ daysWithEntry: 0, daysInMonth: 30 });
  });

  it('серия: подряд до сегодня, без сегодняшней записи считается от вчера, разрыв обрывает', () => {
    expect(streakDays(entries, '2026-10-15')).toBe(3);
    expect(streakDays(entries, '2026-10-16')).toBe(3);
    expect(streakDays(entries, '2026-10-17')).toBe(0);
    expect(streakDays(buildEntries([s(1, '2026-10-15T09:00:00Z'), s(2, '2026-10-12T09:00:00Z')], [], []), '2026-10-15')).toBe(1);
    expect(streakDays([], '2026-10-15')).toBe(0);
  });

  it('день записи по createdAt — местный: 21:19 UTC 26.10 — это 27.10 по Москве (инцидент 2026-10-26)', () => {
    withTimeZone('Europe/Moscow', () => {
      const night = buildEntries([s(1, '2026-10-26T21:19:00Z')], [], [g(1, '2026-10-27')]);
      expect(groupByDay(night).map((x) => [x.dateKey, x.items.length])).toEqual([['2026-10-27', 2]]);
    });
  });

  it('склоняет «запись»', () => {
    expect([1, 3, 5, 0].map(pluralEntries)).toEqual(['1 запись', '3 записи', '5 записей', '0 записей']);
  });
});
