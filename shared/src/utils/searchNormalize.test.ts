import { describe, it, expect } from 'vitest';
import { matchesSearch, normalizeSearchText } from './searchNormalize';

describe('normalizeSearchText', () => {
  it('нижний регистр и «ё» → «е», в том числе заглавная «Ё»', () => {
    expect(normalizeSearchText('Семён')).toBe('семен');
    expect(normalizeSearchText('ЁЛКА')).toBe('елка');
    expect(normalizeSearchText('Анна')).toBe('анна');
  });
});

describe('matchesSearch', () => {
  // QA 2026-11: поиск клиента не находил «е» по «ё» и наоборот.
  it('«е» находит «ё» и обратно', () => {
    expect(matchesSearch('Семён Петров', 'семен')).toBe(true);
    expect(matchesSearch('Алена', 'Алёна')).toBe(true);
    expect(matchesSearch('Фёдор', 'ФЕД')).toBe(true);
  });

  it('регистр не важен, пробелы вокруг запроса срезаются', () => {
    expect(matchesSearch('Анна Крылова', '  КРЫЛ ')).toBe(true);
  });

  it('пустой запрос подходит всем, чужая подстрока — нет', () => {
    expect(matchesSearch('Анна', '')).toBe(true);
    expect(matchesSearch('Анна', '   ')).toBe(true);
    expect(matchesSearch('Анна', 'иван')).toBe(false);
    expect(matchesSearch('', 'а')).toBe(false);
  });
});
