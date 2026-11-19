// Подсветка совпадений в строке выдачи: диапазоны в исходном тексте.
import { describe, it, expect } from 'vitest';
import { highlightRanges } from './highlight';

const cut = (text: string, query: string) =>
  highlightRanges(text, query).map(([from, to]) => text.slice(from, to));

describe('highlightRanges', () => {
  it('запрос целиком — первое вхождение, лучше в начале слова', () => {
    expect(highlightRanges('Режим Критика', 'реж')).toEqual([[0, 3]]);
    expect(highlightRanges('Мой план и планы', 'план')).toEqual([[4, 8]]);
    expect(highlightRanges('Неплановый план', 'план')).toEqual([[11, 15]]);
    expect(cut('Здоровый Взрослый', 'ослы')).toEqual(['ослы']);
  });

  it('регистр и «ё/е» не различаются, вырезается исходный текст', () => {
    expect(cut('Семён Иванов', 'семен')).toEqual(['Семён']);
  });

  it('падеж: слово запроса подсвечивает начало слова текста', () => {
    expect(cut('Режим Критика', 'критиком')).toEqual(['Критик']);
  });

  it('два слова запроса — два диапазона по порядку текста', () => {
    expect(cut('Уязвимый Ребёнок', 'ребёнка уязвимого')).toEqual([
      'Уязвим',
      'Ребёнок',
    ]);
  });

  it('слово с опечаткой подсвечивается целиком', () => {
    expect(cut('Заброшенность', 'заброшеность')).toEqual(['Заброшенность']);
  });

  it('пустой запрос и текст без совпадений — пусто', () => {
    expect(highlightRanges('Режим Критика', '  ')).toEqual([]);
    expect(highlightRanges('Записи', 'критик')).toEqual([]);
  });
});
