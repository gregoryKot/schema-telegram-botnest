import { getHost } from '../../../shared/src/host';

export type Theme = 'dark' | 'light';

const KEY = 'app_theme';

function detectTheme(): Theme {
  // 1. Тема хоста (в браузере её нет — там сразу системная)
  const scheme = getHost().colorScheme();
  if (scheme === 'light') return 'light';
  if (scheme === 'dark') return 'dark';
  // 2. System preference
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches)
    return 'light';
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
