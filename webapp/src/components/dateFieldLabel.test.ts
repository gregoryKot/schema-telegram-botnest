import { describe, expect, it } from 'vitest';
import { dateFieldLabel } from './dateFieldLabel';
import { todayStr } from '../utils/format';

describe('dateFieldLabel', () => {
  it('текущий год — день и месяц словом, другой — с годом, пусто — призыв выбрать', () => {
    const y = todayStr().slice(0, 4);
    expect(dateFieldLabel(`${y}-11-26`)).toBe('26 ноября');
    expect(dateFieldLabel('1999-03-08')).toBe('8 марта 1999');
    expect(dateFieldLabel('')).toBe('Выбрать дату');
  });
});
