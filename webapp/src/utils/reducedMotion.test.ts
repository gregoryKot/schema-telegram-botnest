// @vitest-environment jsdom
// Тесты сниженной анимации (нейроинклюзивность, волна 1).
// Чистая логика: ручной выбор ИЛИ системный prefers-reduced-motion.
import { describe, it, expect, vi } from 'vitest';
import { isReducedFrom, parseMotionPref, getMotionPref, setMotionPref, syncMotionAttr } from './reducedMotion';

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

// Аудит 2026-11, E10: syncMotionAttr зовётся при загрузке модуля AppShell —
// бросок недоступного хранилища давал белый экран.
describe('хранилище недоступно', () => {
  it('выбор читается как «как в системе», запись и синхронизация не бросают', () => {
    const denied = () => { throw new DOMException('denied', 'SecurityError'); };
    const spies = (['getItem', 'setItem', 'removeItem'] as const).map((m) =>
      vi.spyOn(Storage.prototype, m).mockImplementation(denied));
    try {
      expect(getMotionPref()).toBe('system');
      expect(() => syncMotionAttr()).not.toThrow();
      expect(() => setMotionPref('reduced')).not.toThrow();
    } finally {
      spies.forEach((sp) => sp.mockRestore());
    }
  });

  it('контроль: доступное хранилище помнит выбор', () => {
    setMotionPref('reduced');
    expect(getMotionPref()).toBe('reduced');
    expect(document.documentElement.getAttribute('data-reduce-motion')).toBe('1');
    setMotionPref('system');
    expect(getMotionPref()).toBe('system');
  });
});
