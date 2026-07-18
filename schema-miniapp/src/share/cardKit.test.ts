// Тесты чистой логики кита карточек: перенос и обрезка строк.
import { describe, it, expect } from 'vitest';
import { wrapLines, clampLines } from '../../../shared/src/share/cardKit';

// measure: 10px на символ — предсказуемая ширина для тестов
const measure = (s: string) => s.length * 10;

describe('wrapLines', () => {
  it('пустой текст → пусто', () => {
    expect(wrapLines(measure, '', 100)).toEqual([]);
    expect(wrapLines(measure, '   ', 100)).toEqual([]);
  });

  it('короткая строка не переносится', () => {
    expect(wrapLines(measure, 'один два', 100)).toEqual(['один два']);
  });

  it('переносит по словам при переполнении', () => {
    // 'aaaa bbbb' = 90px > 60 → перенос
    expect(wrapLines(measure, 'aaaa bbbb cccc', 60)).toEqual([
      'aaaa',
      'bbbb',
      'cccc',
    ]);
  });

  it('слово длиннее строки остаётся одной строкой (не режется)', () => {
    expect(wrapLines(measure, 'сверхдлинноеслово да', 50)).toEqual([
      'сверхдлинноеслово',
      'да',
    ]);
  });

  it('схлопывает множественные пробелы и переводы строк', () => {
    expect(wrapLines(measure, 'a  b\nc', 1000)).toEqual(['a b c']);
  });
});

describe('clampLines', () => {
  it('не трогает список короче лимита', () => {
    expect(clampLines(['a', 'b'], 3)).toEqual(['a', 'b']);
  });

  it('обрезает и ставит многоточие', () => {
    expect(clampLines(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'b…']);
  });

  it('заменяет конечную пунктуацию на многоточие', () => {
    expect(clampLines(['начало', 'конец,', 'хвост'], 2)).toEqual([
      'начало',
      'конец…',
    ]);
  });
});
