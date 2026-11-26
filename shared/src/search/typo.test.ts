// Опечатки общего поиска: одна правка в слове от 5 букв, короткие слова — только точно.
import { describe, it, expect } from 'vitest';
import { typoMatch, withinOneEdit } from './typo';

describe('withinOneEdit', () => {
  it('равные строки, вставка, удаление, замена и перестановка соседних — одна правка', () => {
    expect(withinOneEdit('критик', 'критик')).toBe(true);
    expect(withinOneEdit('заброшеность', 'заброшенность')).toBe(true);
    expect(withinOneEdit('александрр', 'александр')).toBe(true);
    expect(withinOneEdit('кретик', 'критик')).toBe(true);
    expect(withinOneEdit('критки', 'критик')).toBe(true);
  });

  it('две правки и разница длины больше одной — нет', () => {
    expect(withinOneEdit('кретек', 'критик')).toBe(false);
    expect(withinOneEdit('крит', 'критик')).toBe(false);
    expect(withinOneEdit('', 'а')).toBe(true);
  });
});

describe('typoMatch', () => {
  it('слово от 5 букв находит слово текста с одной опечаткой', () => {
    expect(typoMatch('Заброшенность', 'заброшеность')).toBe(true);
    expect(typoMatch('Александр Петров', 'Алексадр')).toBe(true);
  });

  it('недописанное слово с опечаткой находит начало слова текста', () => {
    expect(typoMatch('Заброшенность', 'забпош')).toBe(true);
  });

  it('слово короче 5 букв с опечаткой не находит; запрос без слов — нет', () => {
    expect(typoMatch('Режим Критика', 'режм')).toBe(false);
    expect(typoMatch('Режим Критика', '?!')).toBe(false);
  });

  it('каждое слово запроса обязано найтись: одно по стему, другое с опечаткой', () => {
    expect(typoMatch('Уязвимый Ребёнок', 'ребёнка уязвмый')).toBe(true);
    expect(typoMatch('Уязвимый Ребёнок', 'ребёнка критек')).toBe(false);
  });
});
