// @vitest-environment jsdom
// Тест переключения темы (theme.ts): детекция системной темы через
// matchMedia, персист в localStorage, применение к document.documentElement.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTheme, applyTheme, toggleTheme, resetToSystemTheme } from './theme';

function mockMatchMedia(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.background = '';
  document.documentElement.style.colorScheme = '';
  document.getElementById('theme-color-meta')?.remove();
  mockMatchMedia(false);
});

describe('getTheme', () => {
  it('без сохранённого выбора берёт системную тему (light)', () => {
    mockMatchMedia(false);
    expect(getTheme()).toBe('light');
  });

  it('без сохранённого выбора берёт системную тему (dark)', () => {
    mockMatchMedia(true);
    expect(getTheme()).toBe('dark');
  });

  it('сохранённый выбор в localStorage имеет приоритет над системной темой', () => {
    mockMatchMedia(true); // система хочет dark
    localStorage.setItem('app_theme', 'light'); // юзер явно выбрал light
    expect(getTheme()).toBe('light');
  });
});

describe('applyTheme', () => {
  it('ставит data-theme, colorScheme и фон на documentElement', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.documentElement.style.background).toBe('rgb(20, 20, 26)');
  });

  it('сохраняет выбор в localStorage', () => {
    applyTheme('light');
    expect(localStorage.getItem('app_theme')).toBe('light');
  });

  it('обновляет content у meta#theme-color-meta, если он есть на странице', () => {
    const meta = document.createElement('meta');
    meta.id = 'theme-color-meta';
    document.head.appendChild(meta);
    applyTheme('dark');
    expect(meta.content).toBe('#14141a');
  });

  it('не бросает, если meta#theme-color-meta отсутствует', () => {
    expect(() => applyTheme('light')).not.toThrow();
  });
});

describe('toggleTheme', () => {
  it('переключает light → dark и обратно, применяя и сохраняя новое значение', () => {
    applyTheme('light');
    expect(toggleTheme()).toBe('dark');
    expect(getTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    expect(toggleTheme()).toBe('light');
    expect(getTheme()).toBe('light');
  });
});

describe('resetToSystemTheme', () => {
  it('убирает ручной выбор из localStorage и возвращает системную тему', () => {
    applyTheme('dark'); // ручной выбор
    mockMatchMedia(false); // система хочет light
    const theme = resetToSystemTheme();
    expect(theme).toBe('light');
    expect(localStorage.getItem('app_theme')).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('после сброса getTheme снова читает системную тему напрямую', () => {
    applyTheme('light');
    mockMatchMedia(true);
    resetToSystemTheme();
    expect(getTheme()).toBe('dark');
  });
});
