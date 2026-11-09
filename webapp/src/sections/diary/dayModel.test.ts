import { describe, it, expect } from 'vitest';
import { buildEntries } from './diaryModel';
import { buildTrackerDays, trackerDayValue } from './trackerEntries';
import { diaryWeek, listCoversWeek, segCounts, splitDay, weekRows, weekStart } from './dayModel';

const s = (id: number, createdAt: string, schemaIds: string[] = ['abandonment']) => ({ id, createdAt, trigger: 't', emotions: [], schemaIds });
const m = (id: number, createdAt: string, fromCase?: boolean) => ({ id, createdAt, modeId: 'punitive_critic', situation: 's', fromCase });
const g = (id: number, date: string, items = ['a']) => ({ id, date, items, createdAt: date + 'T20:00:00Z' });
const all5 = (v: number) => ({ attachment: v, autonomy: v, expression: v, play: v, limits: v });

describe('splitDay: трекер — в строку даты, записи — карточками', () => {
  const tracker = buildTrackerDays([{ date: '2026-10-15', ratings: all5(7) }]);
  const day = buildEntries([s(1, '2026-10-15T09:00:00Z')], [m(2, '2026-10-15T12:00:00Z')], [], tracker);

  it('трекер уходит из списка карточек, порядок записей прежний', () => {
    const { tracker: t, entries } = splitDay(day);
    expect(t?.date).toBe('2026-10-15');
    expect(entries.map((e) => e._type)).toEqual(['mode', 'schema']);
  });

  it('день только с трекером — без карточек; день без трекера — tracker null', () => {
    expect(splitDay(day.filter((e) => e._type === 'tracker')).entries).toEqual([]);
    expect(splitDay(day.filter((e) => e._type !== 'tracker')).tracker).toBeNull();
  });

  it('полоски дня — оценки по потребностям, пустое место — null (не выдуманная высота)', () => {
    const [d] = buildTrackerDays([{ date: '2026-10-15', ratings: { attachment: 4, play: 9 } }]);
    expect(d.values).toEqual([4, null, null, 9, null]);
    expect(trackerDayValue(d)).toBe('2 из 5');
    expect(trackerDayValue(tracker[0])).toBe('индекс 7,0');
  });
});

describe('weekRows: сводка недели — только реальные записи семи дней', () => {
  const today = '2026-10-15';
  const entries = buildEntries(
    [s(1, '2026-10-15T09:00:00Z'), s(2, '2026-10-14T09:00:00Z', []), s(3, '2026-10-08T09:00:00Z')],
    [m(4, '2026-10-13T12:00:00Z'), m(5, '2026-10-12T12:00:00Z', true)],
    [g(6, '2026-10-11', ['a', 'b'])],
    buildTrackerDays([{ date: '2026-10-15', ratings: all5(6) }, { date: '2026-10-08', ratings: all5(6) }]),
  );

  it('считает по типам в порядке сегмента; 8 октября — уже не эта неделя', () => {
    expect(weekRows(entries, today)).toEqual([
      { kind: 'schema', count: 1 }, { kind: 'thought', count: 1 }, { kind: 'mode', count: 1 },
      { kind: 'gratitude', count: 1 }, { kind: 'case', count: 1 }, { kind: 'tracker', count: 1 },
    ]);
  });

  it('пустая неделя — пустой список (сводки нет), будущая дата не считается', () => {
    expect(weekRows(entries, '2026-11-15')).toEqual([]);
    expect(weekRows(entries, '2026-10-01')).toEqual([]);
  });

  it('неделя — сегодня и шесть дней до него', () => {
    expect(weekStart(today)).toBe('2026-10-09');
  });

  it('список покрывает неделю: страниц больше нет или самая старая запись старше её начала', () => {
    expect(listCoversWeek(undefined, false, today)).toBe(true);
    expect(listCoversWeek('2026-10-08', true, today)).toBe(true);
    expect(listCoversWeek('2026-10-09', true, today)).toBe(false);
    expect(listCoversWeek(undefined, true, today)).toBe(false);
  });
});

describe('diaryWeek: сводка только когда все три дневника загружены на неделю', () => {
  const today = '2026-10-15';
  const schema = [s(1, '2026-10-15T09:00:00Z'), s(2, '2026-10-01T09:00:00Z')];
  const entries = buildEntries(schema, [], []);
  const lists = (more: boolean, rows = schema) => ({ schema: rows, mode: [], gratitude: [], more: { schema: more, mode: false, gratitude: false } });

  it('старшая запись старше недели или страниц больше нет — счёт есть', () => {
    expect(diaryWeek(entries, lists(true), today)).toEqual([{ kind: 'schema', count: 1 }]);
    expect(diaryWeek(entries, lists(false, schema.slice(0, 1)), today)).toEqual([{ kind: 'schema', count: 1 }]);
  });

  it('страница кончилась внутри недели, а на сервере есть ещё — сводки нет (цифра была бы меньше правды)', () => {
    expect(diaryWeek(entries, lists(true, schema.slice(0, 1)), today)).toEqual([]);
  });
});

describe('segCounts: «0» в сегменте — только когда записей правда нет', () => {
  const counts = { all: 3, tracker: 1, case: 0, diary: 2 };
  const ok = { loading: false, loadFailed: false, trackerFailed: false };
  it('загружено — числа как есть', () => expect(segCounts(counts, ok)).toEqual(counts));
  it('загрузка и сбой первой загрузки (записей ещё нет) — без чисел', () => {
    expect(segCounts(counts, { ...ok, loading: true })).toBeNull();
    const none = { all: 0, tracker: 0, case: 0, diary: 0 };
    expect(segCounts(none, { ...ok, loadFailed: true })).toBeNull();
  });
  it('сбой повторной загрузки при показанных записях — числа на месте', () => {
    expect(segCounts(counts, { ...ok, loadFailed: true })).toEqual(counts);
  });
  it('сбой трекера — без числа у «Трекера», остальные на месте', () => {
    expect(segCounts(counts, { ...ok, trackerFailed: true })).toEqual({ ...counts, tracker: null });
  });
});
