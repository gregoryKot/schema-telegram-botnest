export type Theme = 'dark' | 'light';

const KEY = 'app_theme';

function detectTheme(): Theme {
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function getTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) ?? detectTheme();
}

const THEME_BG: Record<Theme, string> = { light: '#f5f2eb', dark: '#14141a' };

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.background = THEME_BG[theme];
  document.documentElement.style.colorScheme = theme;
  const meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null;
  if (meta) meta.content = THEME_BG[theme];
  localStorage.setItem(KEY, theme);
}

/** Кабинет (AppShell) нарисован только в светлой теме (редизайн 2026-10,
 *  решение владельца): документ переводится в светлую схему БЕЗ записи в
 *  localStorage — выбор для публичных страниц (лендинг со своим тумблером)
 *  остаётся за пользователем, а тёмные фон/скроллбары не просачиваются в
 *  кабинет через color-scheme. */
export function applyCabinetLightTheme() {
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.style.background = THEME_BG.light;
  document.documentElement.style.colorScheme = 'light';
  const meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null;
  if (meta) meta.content = THEME_BG.light;
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/** Clear manual selection and apply system theme */
export function resetToSystemTheme(): Theme {
  localStorage.removeItem(KEY);
  const theme = detectTheme();
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}
