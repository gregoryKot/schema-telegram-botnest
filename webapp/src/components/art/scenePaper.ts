// Палитра сцен — крупных картинок лендинга и мини-тестов (LandingScenes*.tsx).
// Та же бумага, что у мелких знаков (PAPER), плюс тил, небо и светлые и глубокие
// тона тех же оттенков. Только токены и color-mix от них (check-color-drift); небо —
// переменная холста сцены (--scn-sky, styles/paper-scenes.css): токена неба у палитры нет.
// Отдельный файл: модули компонентов экспортируют только компоненты (react-refresh).
import { PAPER } from './paper';

/** Светлая бумага того же оттенка: токен, разбавленный цветом страницы. */
const soft = (token: string, pct: number) => `color-mix(in srgb, var(${token}) ${pct}%, var(--bg))`;
/** Тот же оттенок глубже — изнанка ленты, ушедшей за полоску (на шаг, не в коричневый). */
const deep = (token: string, pct: number) => `color-mix(in srgb, var(${token}) ${pct}%, var(--text))`;

export const INK = {
  ...PAPER,
  teal: 'var(--c-teal)',
  sky: 'var(--scn-sky)',
  sheet: 'var(--surface)',
  clayBack: deep('--c-clay', 82),
  amberSoft: soft('--c-amber', 42),
  tealSoft: soft('--c-teal', 38),
} as const;

/** Холст всех сцен: 320×260, пропорция одна — вёрстка не прыгает от сцены к сцене. */
export const SCENE_BOX = '0 0 320 260';
