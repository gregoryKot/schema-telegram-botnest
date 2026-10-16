// Общие стили схемы случая: только токены, оттенки — через colorMix, без
// размытия и цветовых литералов (гейты color-drift / var-alpha-suffix /
// render-poison).
import type { CSSProperties } from 'react';

/** Мелкая подпись-заголовок над блоком или полем. */
export const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-sub)',
};

export const hintStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--text-sub)',
};

export const boxStyle: CSSProperties = {
  minWidth: 0,
  padding: 'var(--space-12) var(--space-14)',
  borderRadius: 'var(--r-14)',
  border: '1px solid rgba(var(--fg-rgb),0.1)',
  background: 'var(--surface)',
};
