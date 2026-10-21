import { describe, it, expect } from 'vitest';
import { asArray, cleanHistoryDays } from './safeData';
import { buildHistory } from './model';

describe('asArray', () => {
  it('массив возвращается как есть, не-массив (`{}` при сбое, null) — пусто', () => {
    expect(asArray([1, 2])).toEqual([1, 2]);
    expect(asArray({} as never)).toEqual([]);
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
  });
});

describe('cleanHistoryDays', () => {
  it('строки без даты или без оценок пропускаются', () => {
    const rows = [
      null,
      { date: '2026-01-01' },
      { ratings: { a: 1 } },
      { date: '2026-01-02', ratings: { a: 3 } },
    ] as never;
    expect(cleanHistoryDays(rows)).toEqual([
      { date: '2026-01-02', ratings: { a: 3 } },
    ]);
  });

  it('`{}` вместо массива не роняет разбор истории («e is not iterable»)', () => {
    for (const bad of [{}, null, undefined, 'x']) {
      expect(
        buildHistory(cleanHistoryDays(bad as never), { a: 4, b: 6 }),
      ).toEqual([5]);
    }
  });
});
