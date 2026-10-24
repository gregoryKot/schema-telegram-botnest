import { describe, it, expect } from 'vitest';
import { EXERCISES, LIBRARY_HUES, exerciseHue, fmtCount } from './exerciseLibrary';

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

// fmtAgo здесь не тестируется: копия одна — shared/src/utils/format.ts, её
// сьют гоняет все зоны. Подпись «пройдено» без даты — в ExerciseLibrary.test.tsx.
describe('форматирование', () => {
  it('fmtCount', () => {
    expect(fmtCount(1)).toBe('1 запись');
    expect(fmtCount(3)).toBe('3 записи');
    expect(fmtCount(7)).toBe('7 записей');
  });
});
