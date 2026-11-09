import { createContext } from 'react';

/** Бумага референса (PaperArt*.tsx): зелень, шалфей, коричневый, терракота; знаки —
 *  ещё небо, солома, слива. Отдельный файл: файл компонентов экспортирует только
 *  компоненты (react-refresh/only-export-components). */
export const PAPER = {
  moss: 'var(--c-moss)',
  sage: 'color-mix(in srgb, var(--c-moss) 55%, var(--bg))',
  brown: 'var(--text-sub)',
  clay: 'var(--c-clay)',
  slate: 'var(--c-slate)',
  amber: 'var(--c-amber)',
  plum: 'var(--c-plum)',
  /** Пустое место мотива (полоска без оценки, камешек, который ещё не лёг): тон глубже
   *  бумаги под ним на любом --h — тёмный токен с прозрачностью, а не серый. */
  hollow: 'color-mix(in srgb, var(--text) 10%, transparent)',
} as const;

/**
 * Столбики дня на экране «Готово» трекера (DayBars): бумага полосок Strokes над ними, но без
 * шалфея — на шалфейном листе экрана он даёт 1.7:1, а столбик — данные (WCAG 1.4.11, нужно 3:1).
 * К листу oklch(0.915 0.03 135): мох 3.4, сланец 4.1, коричневый 7.6, глина 3.2, слива 4.2.
 */
export const BAR_PAPER = [PAPER.moss, PAPER.slate, PAPER.brown, PAPER.clay, PAPER.plum] as const;

/**
 * Цвет данных потребности в порядке NEED_ORDER (привязанность, автономия, выражение,
 * спонтанность, границы) — полоска, которая значит конкретную потребность (Strokes values,
 * столбик дня): оттенок NEED_HUE, текстовый токен с контрастом ≥3:1 к бумаге каждого из десяти
 * оттенков (docs/design/APP_2026-11.md, «Палитра данных», решение 7). Обезличенные полоски
 * (меню, пустая плитка, лендинг) остаются на палитре Strokes; «Зачем это всё» — эта (why/WhySign).
 */
export const NEED_DATA_PAPER = [
  'var(--c-clay)', 'var(--c-amber-strong)', 'var(--c-slate)', 'var(--c-plum)', 'var(--c-moss)',
] as const;

/**
 * Размер знака — класс .pp-art--* (styles/paper.css): hero 112×94, square 112×60, row 44×24
 * (строка-сущность), empty 56×48, nav 24×14 (меню, вкладки, чипы), scene 180×150 (опорный
 * элемент главной и героя потока на компьютере).
 */
export interface ArtProps { size?: 'hero' | 'square' | 'row' | 'empty' | 'nav' | 'scene' }

/** Место знака внутри сцены (единицы холста 320×260): знак ложится вложенным svg этой рамки. */
export interface ArtFrame { x: number; y: number; w: number; h: number }
/** Рамка знака в сцене (SignInScene, AppScenes.tsx); вне сцены — null, размер задаёт класс. */
export const ArtFrameContext = createContext<ArtFrame | null>(null);
