// Стили листов подсказок терапевту (#995): колонка чтения и абзац справочника.
import type { CSSProperties } from 'react';

export const guideTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.6,
  color: 'var(--text)',
  whiteSpace: 'pre-line',
};

/** Колонка листа подсказок: текст справочника читается строкой ~70 знаков, а не во всю ширину окна. */
export const guideColumnStyle: CSSProperties = {
  maxWidth: 680,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-24)',
};
