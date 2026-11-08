// @vitest-environment jsdom
// Тест переключения темы (theme.ts): детекция системной темы через
// matchMedia, персист в localStorage, применение к document.documentElement.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTheme, applyTheme, toggleTheme, resetToSystemTheme, applyCabinetLightTheme, savedTheme } from './theme';

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

describe('applyCabinetLightTheme', () => {
  it('переводит документ в светлую схему, не трогая сохранённый выбор пользователя', () => {
    localStorage.setItem('app_theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    applyCabinetLightTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(getTheme()).toBe('dark');
  });
});

// Аудит 2026-11, E10: App.tsx читает тему при загрузке модуля — бросок
// недоступного хранилища давал белый экран.
describe('хранилище недоступно', () => {
  it('тема — системная, применение и сброс не бросают', () => {
    mockMatchMedia(true);
    const denied = () => { throw new DOMException('denied', 'SecurityError'); };
    const spies = (['getItem', 'setItem', 'removeItem'] as const).map((m) =>
      vi.spyOn(Storage.prototype, m).mockImplementation(denied));
    try {
      expect(savedTheme()).toBeNull();
      expect(getTheme()).toBe('dark');
      expect(() => applyTheme('light')).not.toThrow();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(() => resetToSystemTheme()).not.toThrow();
    } finally {
      spies.forEach((sp) => sp.mockRestore());
    }
  });

  it('мусор в ключе — не выбор: savedTheme null, тема системная', () => {
    localStorage.setItem('app_theme', 'purple');
    expect(savedTheme()).toBeNull();
    expect(getTheme()).toBe('light');
  });
});
