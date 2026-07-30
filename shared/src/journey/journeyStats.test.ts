// Тесты сводки «Моего пути» по записям ленты: она включается, когда выбран
// фильтр периода, и обязана называть занятия так же, как сводка за всё время
// (иначе «за месяц» и «за всё время» говорят про одно разными словами).
import { describe, it, expect } from 'vitest';
import {
  STAT_LABELS,
  journeyStatRows,
  statRowsFromItems,
} from './journeyStats';
import { JOURNEY_TYPE_META, type JourneyCounts } from './journeyMeta';

const EMPTY: JourneyCounts = {
  trackerDays: 0,
  notes: 0,
  schemaDiary: 0,
  modeDiary: 0,
  gratitudeDays: 0,
  practices: 0,
  plansDone: 0,
  ysqTests: 0,
  childhoodDone: false,
  beliefChecks: 0,
  letters: 0,
  flashcards: 0,
  safePlace: false,
  schemaNotes: 0,
  modeNotes: 0,
};

const items = (pairs: Array<[string, number]>) =>
  pairs.flatMap(([type, n]) =>
    Array.from({ length: n }, () => ({ type, at: '2026-07-20' })),
  );

describe('STAT_LABELS — реестр подписей', () => {
  it('подпись есть у каждого типа записи (правило №4: реестры не разъезжаются)', () => {
    expect(Object.keys(STAT_LABELS).sort()).toEqual(
      Object.keys(JOURNEY_TYPE_META).sort(),
    );
  });

  it('сводка за период и за всё время называют занятие одинаково', () => {
    const allTime = journeyStatRows({ ...EMPTY, trackerDays: 3, letters: 1 });
    const byPeriod = statRowsFromItems(
      items([
        ['tracker_day', 3],
        ['letter', 1],
      ]),
    );
    expect(byPeriod).toEqual(allTime);
  });
});

describe('statRowsFromItems', () => {
  it('считает записи по типу и сортирует по убыванию', () => {
    const rows = statRowsFromItems(
      items([
        ['gratitude', 2],
        ['tracker_day', 5],
        ['mode_diary', 3],
      ]),
    );
    expect(rows.map((r) => [r.label, r.count])).toEqual([
      ['Дни с трекером', 5],
      ['Дневник режимов', 3],
      ['Благодарности', 2],
    ]);
  });

  it('пустая лента → ни одной строки (карточка покажет пустое состояние)', () => {
    expect(statRowsFromItems([])).toEqual([]);
  });

  it('при равных счётчиках порядок стабильный — по алфавиту', () => {
    const rows = statRowsFromItems(
      items([
        ['letter', 1],
        ['gratitude', 1],
      ]),
    );
    expect(rows.map((r) => r.label)).toEqual(['Благодарности', 'Письма себе']);
  });

  it('незнакомый с фронта тип не роняет сводку', () => {
    const rows = statRowsFromItems([{ type: 'новый_тип_с_бэка' }]);
    expect(rows).toEqual([{ emoji: '•', label: 'новый_тип_с_бэка', count: 1 }]);
  });
});
