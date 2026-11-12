import type { CSSProperties } from 'react';
import { wordBtn } from './graphStyles';

// Слово-кнопка в своей строке: зона 44 без отрицательных полей wordBtn. С ними
// техники «На сессии» при шаге строк ~22px перекрывали друг друга, и тап
// попадал в соседнюю (стенд редизайна 2026-11, b32). Сверка —
// ConceptGuideHint.hitbox.test.tsx.
export const rowBtn: CSSProperties = { ...wordBtn, margin: 0 };

/** Техника с историей «делали …» и «журнал →»: одна строка высотой в зону нажатия. */
export const techItem: CSSProperties = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 'var(--space-4)',
};
