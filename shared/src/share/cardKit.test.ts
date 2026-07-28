// Тесты чистой логики кита карточек: перенос/обрезка строк (wrapLines,
// clampLines) — то, что реально тестируется без canvas 2d-контекста (jsdom
// его не реализует; resolveCardTheme/beginCard/draw* остаются непокрытыми).
// Кейсы зеркалят schema-miniapp/src/share/cardKit.test.ts — это отдельный
// прямой тест той же shared-функции, не перенос существующего теста.
import { describe, it, expect } from 'vitest';
import { wrapLines, clampLines, cardFont } from './cardKit';

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

describe('cardFont', () => {
  it('без веса — обычный шрифт', () => {
    expect(cardFont(14)).toBe(
      '14px -apple-system, BlinkMacSystemFont, sans-serif',
    );
  });

  it('bold — с префиксом bold', () => {
    expect(cardFont(14, 'bold')).toBe(
      'bold 14px -apple-system, BlinkMacSystemFont, sans-serif',
    );
  });
});
