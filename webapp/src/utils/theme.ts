export type Theme = 'dark' | 'light';

const KEY = 'app_theme';

function detectTheme(): Theme {
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
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

/** Clear manual selection and apply system theme */
export function resetToSystemTheme(): Theme {
  localStorage.removeItem(KEY);
  const theme = detectTheme();
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}
