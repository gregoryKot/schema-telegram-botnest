// Тесты сниженной анимации (нейроинклюзивность, волна 1).
// Чистая логика: ручной выбор ИЛИ системный prefers-reduced-motion.
import { describe, it, expect } from 'vitest';
import { isReducedFrom, parseMotionPref } from './reducedMotion';

describe('parseMotionPref', () => {
  it('«1» в localStorage — ручной выбор reduced', () => {
    expect(parseMotionPref('1')).toBe('reduced');
  });

  it('отсутствие значения или мусор — system', () => {
    expect(parseMotionPref(null)).toBe('system');
    expect(parseMotionPref('')).toBe('system');
    expect(parseMotionPref('true')).toBe('system');
  });
});

describe('isReducedFrom', () => {
  it('ручной выбор включает независимо от системы', () => {
    expect(isReducedFrom('reduced', false)).toBe(true);
    expect(isReducedFrom('reduced', true)).toBe(true);
  });

  it('system: следует за системной настройкой', () => {
    expect(isReducedFrom('system', true)).toBe(true);
    expect(isReducedFrom('system', false)).toBe(false);
  });
});
