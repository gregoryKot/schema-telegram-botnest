import { describe, it, expect } from 'vitest';
import { dayAvg, dayLevel, needLevel, getDayNum } from './historyMath';

describe('historyMath', () => {
  it('dayAvg считает среднее только по заполненным потребностям', () => {
    const needs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as never[];
    expect(dayAvg({ date: '2020-01-01', ratings: { a: 8, b: 6 } } as never, needs)).toBe(7);
    expect(dayAvg({ date: '2020-01-01', ratings: {} } as never, needs)).toBeNull();
  });
  it('dayLevel делит по порогам 7 и 4', () => {
    expect(dayLevel(7)).toBe('ok');
    expect(dayLevel(4)).toBe('warn');
    expect(dayLevel(3.9)).toBe('err');
  });
  it('needLevel: 0 — нет подписи, 3 — низко, 6 — средне, 7 — хорошо', () => {
    expect(needLevel(0)).toBeNull();
    expect(needLevel(3)?.label).toBe('низко');
    expect(needLevel(6)?.level).toBe('warn');
    expect(needLevel(7)?.label).toBe('хорошо');
  });
  it('getDayNum убирает ведущий ноль', () => {
    expect(getDayNum('2020-01-05')).toBe('5');
  });
});
