// @vitest-environment jsdom
// Семейство celebrated_<день>: отметка дня и проверка.
import { describe, it, expect, beforeEach } from 'vitest';
import { isCelebrated, markCelebrated } from './todayConstants';

beforeEach(() => localStorage.clear());

describe('celebrated', () => {
  it('отметил день — день отмечен, ключ = 1', () => {
    expect(isCelebrated('2026-11-05')).toBe(false);
    markCelebrated('2026-11-05');
    expect(isCelebrated('2026-11-05')).toBe(true);
    expect(localStorage.getItem('celebrated_2026-11-05')).toBe('1');
  });

  it('другой день не отмечен', () => {
    markCelebrated('2026-11-05');
    expect(isCelebrated('2026-11-06')).toBe(false);
  });
});
