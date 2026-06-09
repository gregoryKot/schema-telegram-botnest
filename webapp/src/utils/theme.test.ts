import { describe, it, expect } from 'vitest';
import { getTheme, applyTheme, toggleTheme, resetToSystemTheme } from './theme';
import { setMatchMedia } from '../test/setup';

describe('getTheme', () => {
  it('возвращает сохранённый ручной выбор приоритетнее системы', () => {
    applyTheme('dark');
    setMatchMedia(false); // система = light
    expect(getTheme()).toBe('dark');
  });

  it('берёт системную тёмную, если ручного выбора нет', () => {
    setMatchMedia(true); // prefers-color-scheme: dark
    expect(getTheme()).toBe('dark');
  });

  it('по умолчанию светлая, если система не тёмная', () => {
    setMatchMedia(false);
    expect(getTheme()).toBe('light');
  });
});

describe('applyTheme', () => {
  it('ставит data-theme на <html> и сохраняет выбор', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(getTheme()).toBe('dark');
  });
});

describe('toggleTheme', () => {
  it('переключает light → dark → light', () => {
    applyTheme('light');
    expect(toggleTheme()).toBe('dark');
    expect(toggleTheme()).toBe('light');
  });
});

describe('resetToSystemTheme', () => {
  it('убирает ручной выбор и применяет системную тему', () => {
    applyTheme('dark');
    setMatchMedia(false); // система = light
    expect(resetToSystemTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
