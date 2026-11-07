// Палитра сцен — крупных картинок лендинга и мини-тестов (LandingScenes*.tsx).
// Та же бумага, что у мелких знаков (PAPER), плюс тил и роза и светлые и глубокие
// тона тех же оттенков. Только токены и color-mix от них (check-color-drift).
// Отдельный файл: модули компонентов экспортируют только компоненты (react-refresh).
import { PAPER } from './paper';

/** Светлая бумага того же оттенка: токен, разбавленный цветом страницы. */
const soft = (token: string, pct: number) => `color-mix(in srgb, var(${token}) ${pct}%, var(--bg))`;
/** Тот же оттенок глубже — изнанка ленты, ушедшей за полоску. */
const deep = (token: string, pct: number) => `color-mix(in srgb, var(${token}) ${pct}%, var(--text))`;

export const INK = {
  ...PAPER,
  teal: 'var(--c-teal)',
  rose: 'var(--c-rose)',
  sheet: 'var(--surface)',
  clayDeep: deep('--c-clay', 70),
  amberSoft: soft('--c-amber', 42),
  tealSoft: soft('--c-teal', 38),
  plumSoft: soft('--c-plum', 36),
  slateSoft: soft('--c-slate', 38),
  roseSoft: soft('--c-rose', 42),
} as const;

/** Холст всех сцен: 320×260, пропорция одна — вёрстка не прыгает от сцены к сцене. */
export const SCENE_BOX = '0 0 320 260';
