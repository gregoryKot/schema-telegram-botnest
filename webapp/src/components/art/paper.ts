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

export interface ArtProps { size?: 'hero' | 'square' | 'empty' }
