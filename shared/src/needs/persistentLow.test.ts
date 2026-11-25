import { describe, it, expect } from 'vitest';
import { persistentLowNeeds } from './persistentLow';

const needs = [{ id: 'a' }, { id: 'b' }];

describe('persistentLowNeeds', () => {
  it('низко (≤4) три дня подряд — потребность возвращается', () => {
    const days = [
      { ratings: { a: 4, b: 8 } },
      { ratings: { a: 2, b: 3 } },
      { ratings: { a: 1, b: 9 } },
    ];
    expect(persistentLowNeeds(needs, days)).toEqual([{ id: 'a' }]);
  });
  it('один день выше 4 или без оценки ломает серию', () => {
    expect(
      persistentLowNeeds(needs, [
        { ratings: { a: 5 } },
        { ratings: { a: 2 } },
        { ratings: { a: 2 } },
      ]),
    ).toEqual([]);
    expect(
      persistentLowNeeds(needs, [
        { ratings: { a: 2 } },
        { ratings: {} },
        { ratings: { a: 2 } },
      ]),
    ).toEqual([]);
  });
  it('истории меньше трёх дней — пусто', () => {
    expect(
      persistentLowNeeds(needs, [{ ratings: { a: 1 } }, { ratings: { a: 1 } }]),
    ).toEqual([]);
  });
});
