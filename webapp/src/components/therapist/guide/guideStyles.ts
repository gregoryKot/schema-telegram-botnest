// Стили листов подсказок терапевту (#995): колонка чтения и абзац справочника.
import type { CSSProperties } from 'react';

export const guideTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.6,
  color: 'var(--text)',
  whiteSpace: 'pre-line',
};

/** Ширина колонки листа подсказок: текст справочника читается строкой ~70 знаков, а не во всю ширину окна. */
export const GUIDE_COLUMN = 680;

/** Колонка листа подсказок; шапка листа встаёт в ту же ширину (ConceptFullscreenSheet `column`). */
export const guideColumnStyle: CSSProperties = {
  maxWidth: GUIDE_COLUMN,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-24)',
};
