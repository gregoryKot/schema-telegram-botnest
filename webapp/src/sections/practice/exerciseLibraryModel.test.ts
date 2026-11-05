import { describe, it, expect } from 'vitest';
import { fmtCount } from './exerciseLibraryModel';

// fmtAgo здесь не тестируется: копия одна — shared/src/utils/format.ts, её
// сьют гоняет все зоны. Подпись «пройдено» без даты — в ExerciseLibrary.test.tsx.
describe('форматирование', () => {
  it('fmtCount', () => {
    expect(fmtCount(1)).toBe('1 запись');
    expect(fmtCount(3)).toBe('3 записи');
    expect(fmtCount(7)).toBe('7 записей');
  });
});
