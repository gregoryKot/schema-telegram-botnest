// Тему карточек теперь резолвит и бэкенд (пин фразы для Pinterest), где DOM
// нет вообще. Без этого теста регресс выглядел бы как падение публикации
// раз в сутки — на фронтендах-то всё осталось бы зелёным.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveCardTheme } from './theme';

describe('resolveCardTheme', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('без DOM отдаёт дефолтную тёмную тему, а не падает', () => {
    vi.stubGlobal('document', undefined);
    const theme = resolveCardTheme();
    expect(theme.bg).toBe('#191b25');
    expect(theme.isLight).toBe(false);
    expect(theme.fg(0.5)).toBe('rgba(255, 255, 255,0.5)');
  });

  it('в браузере берёт цвета из CSS-переменных фронтенда', () => {
    const vars: Record<string, string> = {
      '--bg': '#ffffff',
      '--accent': '#123456',
    };
    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => vars[name] ?? '',
    }));
    const theme = resolveCardTheme();
    expect(theme.bg).toBe('#ffffff');
    expect(theme.accent).toBe('#123456');
    // Светлый фон переключает свечения и заливки — это видно по isLight.
    expect(theme.isLight).toBe(true);
  });

  it('var(--x) внутри переменной разворачивается до цвета', () => {
    const vars: Record<string, string> = {
      '--sheet-bg': 'var(--bg-elev)',
      '--bg-elev': '#0a0a0a',
    };
    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => vars[name] ?? '',
    }));
    expect(resolveCardTheme().sheetBg).toBe('#0a0a0a');
  });
});
