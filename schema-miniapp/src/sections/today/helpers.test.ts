// @vitest-environment jsdom
// helpers.ts экрана «Сегодня» (0% покрытия): чистые функции hexToRgb/plural/
// readLocalIds. Мелкие, но плюрализация уже ловила реальные баги в других
// местах (StreakCard) — проверяем границы 11-19 (всегда «many», не «few»).
import { describe, it, expect } from 'vitest';
import { hexToRgb, plural, readLocalIds } from './helpers';

describe('hexToRgb', () => {
  it('переводит #RRGGBB в "r,g,b"', () => {
    expect(hexToRgb('#ff6b9d')).toBe('255,107,157');
  });

  it('работает без решётки (принимает как есть с позиции 1..7)', () => {
    expect(hexToRgb('#000000')).toBe('0,0,0');
  });
});

describe('plural', () => {
  it.each([
    [1, 'запись'],
    [2, 'записи'],
    [4, 'записи'],
    [5, 'записей'],
    [11, 'записей'],
    [12, 'записей'],
    [14, 'записей'],
    [21, 'запись'],
    [22, 'записи'],
    [25, 'записей'],
  ])('plural(%i) → %s', (n, expected) => {
    expect(plural(n, 'запись', 'записи', 'записей')).toBe(expected);
  });
});

describe('readLocalIds', () => {
  it('нет ключа в localStorage — пустой массив', () => {
    localStorage.clear();
    expect(readLocalIds('missing_key')).toEqual([]);
  });

  it('валидный JSON-массив — парсится как есть', () => {
    localStorage.setItem('ids_key', JSON.stringify(['a', 'b', 'c']));
    expect(readLocalIds('ids_key')).toEqual(['a', 'b', 'c']);
  });

  it('битый JSON — не падает, возвращает пустой массив', () => {
    localStorage.setItem('broken_key', '{not json');
    expect(readLocalIds('broken_key')).toEqual([]);
  });
});
