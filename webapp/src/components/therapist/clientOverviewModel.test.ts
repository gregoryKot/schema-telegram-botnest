import { describe, it, expect } from 'vitest';
import { weekDelta, groupSchemasByDomain, summarizeModes, needBars, indexSparkBars, diaryPreview, clientInitials } from './clientOverviewModel';

describe('groupSchemasByDomain', () => {
  it('пусто → нет плиток', () => expect(groupSchemasByDomain([])).toEqual([]));
  it('группирует по доменам в порядке справочника, неизвестные id игнорирует', () => {
    const tiles = groupSchemasByDomain(['abandonment', 'emotional_deprivation', 'nope']);
    expect(tiles).toHaveLength(1);
    expect(tiles[0].id).toBe('rejection');
    expect(tiles[0].schemas.map((s) => s.id)).toEqual(['emotional_deprivation', 'abandonment']);
    expect(typeof tiles[0].hue).toBe('number');
  });
});

describe('summarizeModes', () => {
  it('возвращает все группы, пустые — с пустым списком', () => {
    const cols = summarizeModes(['vulnerable_child']);
    expect(cols.length).toBeGreaterThanOrEqual(4);
    const child = cols.find((c) => c.id === 'child');
    expect(child?.modes.map((m) => m.id)).toEqual(['vulnerable_child']);
    expect(cols.filter((c) => c.modes.length === 0).length).toBe(cols.length - 1);
  });
});

describe('needBars', () => {
  it('нормирует оценку в %, помечает ≤4, пропускает отсутствующие', () => {
    const bars = needBars({ attachment: 4, autonomy: 7, limits: 12 });
    expect(bars.map((b) => b.id)).toEqual(['attachment', 'autonomy', 'limits']);
    expect(bars[0]).toMatchObject({ widthPct: 40, low: true });
    expect(bars[1]).toMatchObject({ widthPct: 70, low: false });
    expect(bars[2].widthPct).toBe(100);
  });
  it('нет данных → пусто', () => {
    expect(needBars(undefined)).toEqual([]);
    expect(needBars({})).toEqual([]);
  });
});

describe('indexSparkBars', () => {
  it('разворачивает в хронологию, режет до 14, пропуск — пустой столбик', () => {
    const hist = Array.from({ length: 20 }, (_, i) => ({ index: i === 1 ? null : 8 - (i % 3) }));
    const bars = indexSparkBars(hist);
    expect(bars).toHaveLength(14);
    expect(bars[bars.length - 1]).toEqual({ heightPct: 80, level: 'ok' });
    expect(bars[bars.length - 2]).toEqual({ heightPct: 0, level: 'none' });
  });
  it('уровни: warn и err', () => {
    expect(indexSparkBars([{ index: 5 }, { index: 3 }])).toEqual([
      { heightPct: 30, level: 'err' },
      { heightPct: 50, level: 'warn' },
    ]);
  });
});

describe('diaryPreview', () => {
  it('резолвит заголовки, считает «+N», ограничивает лимитом', () => {
    const rows = diaryPreview([
      { type: 'schema', date: '2026-07-01', schemaIds: ['abandonment', 'mistrust'], excerpt: 'a' },
      { type: 'mode', date: '2026-07-02', modeId: 'vulnerable_child', excerpt: 'b' },
      { type: 'gratitude', date: '2026-07-03', excerpt: 'c' },
    ], 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].typeLabel).toBe('Схема-дневник');
    expect(rows[0].title).toMatch(/ \+1$/);
    expect(rows[1].typeLabel).toBe('Режим-дневник');
    expect(rows[1].title.length).toBeGreaterThan(0);
  });
  it('схема без id и режим без id не падают', () => {
    const rows = diaryPreview([{ type: 'schema', date: 'd', excerpt: '' }, { type: 'mode', date: 'd', excerpt: '' }]);
    expect(rows[0].title).toBe('Схема');
    expect(rows[1].title).toBe('Режим');
  });
});

describe('clientInitials', () => {
  it('две буквы из двух слов, одна из одного, ? для пустого', () => {
    expect(clientInitials('Анна Кузнецова')).toBe('АК');
    expect(clientInitials('второй')).toBe('В');
    expect(clientInitials('  ')).toBe('?');
  });
});

describe('weekDelta', () => {
  const h = (xs: (number | null)[]) => xs.map((index) => ({ index }));
  it('мало истории → null', () => expect(weekDelta(h([7, 6, 6]), 7)).toBeNull());
  it('нет оценок до сегодня → null', () => expect(weekDelta(h([7, null, null, null, null, null, null, null]), 7)).toBeNull());
  it('разница со средним предыдущих дней', () => expect(weekDelta(h([7, 6, 6, 6, 6, 6, 6, 6]), 7)).toBeCloseTo(1));
});
