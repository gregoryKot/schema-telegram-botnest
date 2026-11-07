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
} as const;

/**
 * Столбики дня на экране «Готово» трекера (DayBars): бумага полосок Strokes над ними, но без
 * шалфея — на шалфейном листе экрана он даёт 1.7:1, а столбик — данные (WCAG 1.4.11, нужно 3:1).
 * К листу oklch(0.915 0.03 135): мох 3.4, сланец 4.1, коричневый 7.6, глина 3.2, слива 4.2.
 */
export const BAR_PAPER = [PAPER.moss, PAPER.slate, PAPER.brown, PAPER.clay, PAPER.plum] as const;

export interface ArtProps { size?: 'hero' | 'square' | 'row' | 'empty' }
