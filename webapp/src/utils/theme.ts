import { readLocal, removeLocal, writeLocal } from '../../../shared/src/utils/safeLocalStorage';

export type Theme = 'dark' | 'light';

const KEY = 'app_theme';

const detectTheme = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/** Выбор человека; заблокированное хранилище — null, а не исключение и белый экран (аудит 2026-11, E10). */
export function savedTheme(): Theme | null {
  const v = readLocal(KEY);
  return v === 'dark' || v === 'light' ? v : null;
}

export const getTheme = (): Theme => savedTheme() ?? detectTheme();

/** Фон темы — токен --bg из index.css (у `el` — с учётом .light-lock); пусто, пока CSS не загружен. */
export const themeBg = (el: Element = document.documentElement): string =>
  getComputedStyle(el).getPropertyValue('--bg').trim();

/** data-theme, схема, фон <html> и theme-color браузера; без CSS фон и meta остаются от theme.js и index.html. */
function paintTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  const bg = themeBg();
  if (!bg) return;
  root.style.background = bg;
  document.getElementById('theme-color-meta')?.setAttribute('content', bg);
}

export function applyTheme(theme: Theme) {
  paintTheme(theme);
  writeLocal(KEY, theme);
}

/** Кабинет (AppShell) нарисован только в светлой теме (решение владельца): светлая схема БЕЗ записи
 *  в localStorage — выбор для лендинга остаётся за пользователем, тёмные фон/скроллбары не просачиваются. */
export const applyCabinetLightTheme = () => paintTheme('light');

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/** Clear manual selection and apply system theme */
export function resetToSystemTheme(): Theme {
  removeLocal(KEY);
  const theme = detectTheme();
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}
