import { describe, it, expect } from 'vitest';
import { RATING_WORDS, rangeCardIndex, wordForValue } from './ratingWords';

describe('wordForValue', () => {
  it('каждое значение 1–10 попадает в ближайшее слово парами', () => {
    const labels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
      (v) => wordForValue(v)?.label,
    );
    expect(labels).toEqual([
      'Совсем нет',
      'Совсем нет',
      'Мало',
      'Мало',
      'Наполовину',
      'Наполовину',
      'В основном да',
      'В основном да',
      'Полностью',
      'Полностью',
    ]);
  });

  it('нет оценки — null: 0, undefined, null, NaN, отрицательное', () => {
    for (const v of [0, undefined, null, NaN, -3])
      expect(wordForValue(v)).toBeNull();
  });

  it('значение больше 10 не выходит за последнее слово', () => {
    expect(wordForValue(11)?.label).toBe('Полностью');
  });

  it('значение слова — чётное, и слово возвращает само себя (сохранил → показал то же)', () => {
    for (const w of RATING_WORDS) {
      expect(w.value % 2).toBe(0);
      expect(wordForValue(w.value)).toBe(w);
    }
  });
});

describe('rangeCardIndex', () => {
  it('слова 0–1 → первая карточка, 2 → вторая, 3–4 → третья', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rangeCardIndex)).toEqual([
      0, 0, 0, 0, 1, 1, 2, 2, 2, 2,
    ]);
  });

  it('нет оценки — -1, ни одна карточка не подсвечена', () => {
    for (const v of [0, undefined, null]) expect(rangeCardIndex(v)).toBe(-1);
  });
});
