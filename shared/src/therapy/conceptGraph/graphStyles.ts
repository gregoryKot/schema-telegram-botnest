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

/** Пустая клетка — информация о дефиците, поэтому плашка заметная. */
export const dashedStyle: CSSProperties = {
  padding: 'var(--space-10) var(--space-12)',
  borderRadius: 'var(--r-12)',
  border: '1px dashed rgba(var(--fg-rgb),0.25)',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--text-sub)',
};

export const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-4)',
};

export const miniChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: '2px 8px',
  borderRadius: 'var(--r-20)',
  background: 'rgba(var(--fg-rgb),0.06)',
  color: 'var(--text-sub)',
  fontSize: 11,
  lineHeight: 1.4,
};

export const clamp2: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};
