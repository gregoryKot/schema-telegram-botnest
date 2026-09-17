// @vitest-environment jsdom
// Тема мини-аппа: приоритет — тема хоста (Telegram/MAX colorScheme) > системная
// (matchMedia) > сохранённый ручной выбор персистится в localStorage.
// Не путать с webapp/src/utils/theme.ts — разные реализации (веб-версия ещё
// красит meta#theme-color и фон), общей логики между ними нет, дублировать
// незачем.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setHost } from '../../../shared/src/host';
import { getTheme, applyTheme, toggleTheme, resetToSystemTheme } from './theme';

function mockMatchMedia(prefersLight: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: light)' ? prefersLight : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  setHost(null);
  delete (globalThis as { Telegram?: unknown }).Telegram;
  mockMatchMedia(false);
});

describe('getTheme — приоритет источников', () => {
  it('без сохранённого выбора и без хоста берёт системную тему (light)', () => {
    mockMatchMedia(true);
    expect(getTheme()).toBe('light');
  });

  it('без сохранённого выбора и без хоста берёт системную тему (dark по умолчанию)', () => {
    mockMatchMedia(false);
    expect(getTheme()).toBe('dark');
  });

  it('сохранённый выбор в localStorage важнее системной темы', () => {
    mockMatchMedia(true); // система хочет light
    localStorage.setItem('app_theme', 'dark'); // юзер явно выбрал dark
    expect(getTheme()).toBe('dark');
  });
});

describe('applyTheme / toggleTheme', () => {
  it('applyTheme ставит data-theme и сохраняет выбор', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('app_theme')).toBe('dark');
  });

  it('toggleTheme переключает и сохраняет новое значение', () => {
    applyTheme('light');
    expect(toggleTheme()).toBe('dark');
    expect(getTheme()).toBe('dark');
    expect(toggleTheme()).toBe('light');
    expect(getTheme()).toBe('light');
  });
});

describe('resetToSystemTheme', () => {
  it('убирает ручной выбор и возвращает системную тему', () => {
    applyTheme('dark');
    mockMatchMedia(true); // система хочет light
    const theme = resetToSystemTheme();
    expect(theme).toBe('light');
    expect(localStorage.getItem('app_theme')).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
