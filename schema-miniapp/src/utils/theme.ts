export type Theme = 'dark' | 'light';

const KEY = 'app_theme';

function detectTheme(): Theme {
  // 1. Telegram colorScheme
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.colorScheme === 'light') return 'light';
  if (tg?.colorScheme === 'dark') return 'dark';
  // 2. System preference
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

export function getTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) ?? detectTheme();
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(KEY, theme);
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/** Очистить ручной выбор и применить тему Telegram/системы */
export function resetToSystemTheme(): Theme {
  localStorage.removeItem(KEY);
  const theme = detectTheme();
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}
