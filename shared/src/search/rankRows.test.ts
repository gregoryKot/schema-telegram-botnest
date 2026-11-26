// Вес строки общего поиска: название точнее подзаголовка, падеж, регистр и «ё/е» не важны.
import { describe, it, expect } from 'vitest';
import { ROW_SCORE, rankRows, rowScore } from './rankRows';

describe('rowScore', () => {
  it('название начинается с запроса > слово названия > подстрока > слова по стему > только текст', () => {
    expect(rowScore('Справочник', '', 'справ')).toBe(ROW_SCORE.starts);
    expect(rowScore('Все клиенты', '', 'клиент')).toBe(ROW_SCORE.wordStarts);
    expect(rowScore('Здоровый Взрослый', '', 'ослы')).toBe(ROW_SCORE.contains);
    expect(rowScore('Уязвимый Ребёнок', '', 'ребёнка уязвимого')).toBe(
      ROW_SCORE.stems,
    );
    expect(rowScore('Записи', 'Дневники', 'дневник')).toBe(ROW_SCORE.text);
    expect(rowScore('Записи', 'Дневники', 'критик')).toBe(ROW_SCORE.none);
  });

  it('регистр и «ё/е» не различаются; служебные слова не выпадают', () => {
    expect(rowScore('Семён Иванов', '', 'семен')).toBe(ROW_SCORE.starts);
    expect(
      rowScore('Переключиться в режим клиента', 'Клиентский вид', 'РЕЖИМ'),
    ).toBe(ROW_SCORE.wordStarts);
  });

  it('слова запроса могут сойтись частью в названии, частью в тексте', () => {
    expect(
      rowScore('Дыхание', 'Практики на каждый день', 'дыхание практика'),
    ).toBe(ROW_SCORE.text);
  });

  it('опечатка в слове от 5 букв — наименьший вес, только по названию; короткое слово не прощается', () => {
    expect(rowScore('Заброшенность', '', 'заброшеность')).toBe(ROW_SCORE.typo);
    expect(rowScore('Александр', '', 'Алексадр')).toBe(ROW_SCORE.typo);
    expect(rowScore('Записи', 'Заброшенность', 'заброшеность')).toBe(
      ROW_SCORE.none,
    );
    expect(rowScore('Режим Критика', '', 'режм')).toBe(ROW_SCORE.none);
    expect(ROW_SCORE.typo).toBeLessThan(ROW_SCORE.text);
    expect(rowScore('Заброшенность', '', 'заброшенность')).toBeGreaterThan(
      ROW_SCORE.typo,
    );
  });

  it('пустой запрос подходит всем с весом текста; запрос из знаков — никому', () => {
    expect(rowScore('Сегодня', '', '  ')).toBe(ROW_SCORE.text);
    expect(rowScore('Сегодня', '', '?!')).toBe(ROW_SCORE.none);
  });
});

describe('rankRows', () => {
  it('сортирует по весу, равные — в порядке входа, неподходящие убирает', () => {
    const rows = ['Мой план', 'Планы', 'Записи', 'Планёрка'];
    const ranked = rankRows(rows, 'план', (label) => ({ label, text: '' }));
    expect(ranked.map((r) => r.row)).toEqual(['Планы', 'Планёрка', 'Мой план']);
  });
});
