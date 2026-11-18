/** Пулы подписей под пятью ответами шкалы трекера. */
export interface AnchorPools {
  /** «Совсем нет». */
  low: string[];
  /** «Мало» — в одну строку телефона: коротко. */
  little: string[];
  /** «Наполовину». */
  mid: string[];
  /** «В основном да» — в одну строку телефона: коротко. */
  mostly: string[];
  /** «Полностью». */
  high: string[];
}

/** Ступени в порядке ответов шкалы (RATING_WORDS). */
export const ANCHOR_STEPS = ['low', 'little', 'mid', 'mostly', 'high'] as const;
export type AnchorStep = (typeof ANCHOR_STEPS)[number];
