// Тесты сводки «Моего пути»: счётчики за всё время (включая три быстрые
// практики) и сводка по записям ленты, которая включается при фильтре периода.
// Обе обязаны называть занятия одинаково, иначе «за месяц» и «за всё время»
// говорят про одно разными словами. Пустой аккаунт проверяется отдельно —
// агрегат не должен показывать мусор на чистой БД.
import { describe, it, expect } from 'vitest';
import {
  STAT_LABELS,
  journeyStatRows,
  journeyTotal,
  statRowsFromItems,
} from './journeyStats';
import { JOURNEY_TYPE_META } from './journeyMeta';
import { EMPTY_JOURNEY_COUNTS as EMPTY } from './journeyCounts.fixture';

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

describe('journeyStatRows — быстрые практики', () => {
  it('пустой аккаунт: без новых счётчиков строк нет (не 0/NaN, а пусто)', () => {
    expect(journeyStatRows(EMPTY)).toEqual([]);
    expect(journeyTotal(EMPTY)).toBe(0);
  });

  it('ненулевые счётчики практик — попадают в строки с верным эмодзи/подписью', () => {
    const rows = journeyStatRows({
      ...EMPTY,
      breathingSessions: 4,
      groundingSessions: 2,
      stopSessions: 1,
    });
    expect(rows).toEqual([
      { emoji: '🌬', label: 'Дыхательные практики', count: 4 },
      { emoji: '🌍', label: 'Заземление', count: 2 },
      { emoji: '🛑', label: 'Техника «Стоп»', count: 1 },
    ]);
  });

  it('счётчики практик суммируются в общий итог наравне с остальными', () => {
    const counts = {
      ...EMPTY,
      trackerDays: 3,
      breathingSessions: 2,
      groundingSessions: 1,
      stopSessions: 1,
    };
    expect(journeyTotal(counts)).toBe(7);
  });
});
