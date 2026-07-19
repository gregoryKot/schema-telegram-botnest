// Тесты текстов шаринга: плюрализация и нейтральность формулировок
// (без рода «получил/получила» и без ты/вы — правило CLAUDE.md).
import { describe, it, expect } from 'vitest';
import {
  pluralEntries,
  achievementShareText,
  streakShareText,
  schemaShareText,
  diaryShareText,
} from '../../../shared/src/share/shareTexts';

describe('pluralEntries', () => {
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
    [102, 'записи'],
    [111, 'записей'],
  ])('%i → %s', (n, expected) => {
    expect(pluralEntries(n)).toBe(expected);
  });
});

describe('тексты шаринга', () => {
  it('достижение: эмодзи, титул, ссылка на бота — без рода', () => {
    const text = achievementShareText('🏆', 'Месяц', 't.me/TestBot');
    expect(text).toContain('🏆');
    expect(text).toContain('«Месяц»');
    expect(text).toContain('t.me/');
    expect(text).not.toMatch(/получил|получила/i);
  });

  it('стрик: число дней с правильной формой', () => {
    expect(streakShareText(7, 't.me/TestBot')).toContain('7 дней подряд');
    expect(streakShareText(1, 't.me/TestBot')).toContain('1 день подряд');
    expect(streakShareText(3, 't.me/TestBot')).toContain('3 дня подряд');
    expect(streakShareText(7, 't.me/TestBot')).toContain('t.me/');
  });

  it('схема: название в кавычках', () => {
    const text = schemaShareText('Покинутость', 't.me/TestBot');
    expect(text).toContain('«Покинутость»');
    expect(text).toContain('t.me/');
  });

  it('дневник: счётчик, дата начала, ссылка', () => {
    const text = diaryShareText(
      'Дневник схем',
      '📓',
      12,
      '3 мая',
      't.me/TestBot',
    );
    expect(text).toContain('Дневник схем: 12 записей с 3 мая');
    expect(text).toContain('t.me/');
  });

  it('дневник без даты — без хвоста «с …»', () => {
    const text = diaryShareText('Дневник схем', '📓', 1, null, 't.me/TestBot');
    expect(text).toContain('1 запись.');
  });
});
