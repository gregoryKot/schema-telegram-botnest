import { describe, it, expect } from 'vitest';
import { EXERCISES, LIBRARY_HUES, exerciseHue, fmtAgo, fmtCount } from './exerciseLibrary';

describe('exerciseHue', () => {
  it('раскладывает палитру по кругу', () => {
    expect(exerciseHue(0)).toBe(LIBRARY_HUES[0]);
    expect(exerciseHue(LIBRARY_HUES.length)).toBe(LIBRARY_HUES[0]);
    expect(exerciseHue(LIBRARY_HUES.length + 2)).toBe(LIBRARY_HUES[2]);
  });
  it('соседние карточки библиотеки не совпадают по оттенку', () => {
    for (let i = 1; i < EXERCISES.length; i++) expect(exerciseHue(i)).not.toBe(exerciseHue(i - 1));
  });
});

describe('форматирование', () => {
  const now = new Date('2026-10-15T12:00:00Z').getTime();
  it('fmtAgo', () => {
    expect(fmtAgo(null, now)).toBe('пройдено');
    expect(fmtAgo('2026-10-15T08:00:00Z', now)).toBe('сегодня');
    expect(fmtAgo('2026-10-14T08:00:00Z', now)).toBe('вчера');
    expect(fmtAgo('2026-10-12T08:00:00Z', now)).toBe('3 дн. назад');
  });
  it('fmtCount', () => {
    expect(fmtCount(1)).toBe('1 запись');
    expect(fmtCount(3)).toBe('3 записи');
    expect(fmtCount(7)).toBe('7 записей');
  });
});
