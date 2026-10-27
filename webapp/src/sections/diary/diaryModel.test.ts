import { describe, it, expect } from 'vitest';
import { buildEntries, filterEntries, groupByDay, filterCounts, streakLine } from './diaryModel';
import { buildTrackerDays, trackerDayLabel } from './trackerEntries';

const s = (id: number, createdAt: string) => ({ id, createdAt, trigger: 't', emotions: [], schemaIds: [] });
const m = (id: number, createdAt: string) => ({ id, createdAt, modeId: 'x', situation: 's' });
const g = (id: number, date: string) => ({ id, date, items: ['a'], createdAt: date + 'T20:00:00Z' });
const all5 = (v: number) => ({ attachment: v, autonomy: v, expression: v, play: v, limits: v });

describe('diaryModel', () => {
  const tracker = buildTrackerDays([
    { date: '2026-10-15', ratings: all5(7) },
    { date: '2026-10-13', ratings: { attachment: 4, autonomy: 6 } },
  ]);
  const entries = buildEntries(
    [s(1, '2026-10-15T09:00:00Z'), s(2, '2026-10-13T09:00:00Z')],
    [m(1, '2026-10-15T18:00:00Z')],
    [g(1, '2026-10-14')],
    tracker,
  );

  it('сортирует новые сверху, строка трекера идёт последней внутри своего дня', () => {
    expect(entries.map((e) => e._type)).toEqual(['mode', 'schema', 'tracker', 'gratitude', 'schema', 'tracker']);
    expect(entries.map((e) => e.dateKey)).toEqual([
      '2026-10-15', '2026-10-15', '2026-10-15', '2026-10-14', '2026-10-13', '2026-10-13',
    ]);
  });

  it('без трекера работает как раньше (четвёртый аргумент необязателен)', () => {
    expect(buildEntries([s(1, '2026-10-15T09:00:00Z')], [], []).map((e) => e._type)).toEqual(['schema']);
  });

  it('группирует по дням', () => {
    expect(groupByDay(entries).map((x) => [x.dateKey, x.items.length])).toEqual([
      ['2026-10-15', 3], ['2026-10-14', 1], ['2026-10-13', 2],
    ]);
  });

  it('сегмент «Трекер» оставляет только строки трекера, «Дневник» — всё остальное, «Все» — всё', () => {
    expect(filterEntries(entries, 'tracker').map((e) => e._type)).toEqual(['tracker', 'tracker']);
    expect(filterEntries(entries, 'diary').map((e) => e._type)).toEqual(['mode', 'schema', 'gratitude', 'schema']);
    expect(filterEntries(entries, 'all')).toHaveLength(6);
  });

  it('счётчики сегмента сходятся с фильтром', () => {
    expect(filterCounts(entries)).toEqual({ all: 6, tracker: 2, diary: 4 });
    expect(filterCounts([])).toEqual({ all: 0, tracker: 0, diary: 0 });
  });
});

describe('streakLine', () => {
  it('склоняет «день» и подписывает «Сбиться — не страшно»', () => {
    expect([1, 2, 5, 11, 21, 22].map(streakLine)).toEqual([
      '1 день подряд. Сбиться — не страшно.',
      '2 дня подряд. Сбиться — не страшно.',
      '5 дней подряд. Сбиться — не страшно.',
      '11 дней подряд. Сбиться — не страшно.',
      '21 день подряд. Сбиться — не страшно.',
      '22 дня подряд. Сбиться — не страшно.',
    ]);
  });

  it('серии нет — строки нет (0, отрицательное, NaN)', () => {
    expect([0, -1, NaN].map(streakLine)).toEqual([null, null, null]);
  });
});

describe('buildTrackerDays / trackerDayLabel', () => {
  it('пять оценок — индекс с запятой; неполный день — «N из 5»', () => {
    const days = buildTrackerDays([
      { date: '2026-10-15', ratings: { attachment: 8, autonomy: 6, expression: 7, play: 7, limits: 8 } },
      { date: '2026-10-14', ratings: { attachment: 5, autonomy: 5, expression: 5 } },
    ]);
    expect(days.map(trackerDayLabel)).toEqual(['Трекер — индекс 7,2', 'Трекер: 3 из 5']);
  });

  it('день без единой оценки и пустая история не дают строк (нет данных — нет строки)', () => {
    expect(buildTrackerDays([{ date: '2026-10-15', ratings: {} }])).toEqual([]);
    expect(buildTrackerDays([])).toEqual([]);
  });

  it('чужие ключи в ratings не считаются оценками', () => {
    expect(buildTrackerDays([{ date: '2026-10-15', ratings: { mystery: 9 } }])).toEqual([]);
  });
});
