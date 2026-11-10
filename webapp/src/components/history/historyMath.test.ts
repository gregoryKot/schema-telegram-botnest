import { describe, it, expect } from 'vitest';
import { needLevel, getDayNum } from './historyMath';

describe('historyMath', () => {
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
