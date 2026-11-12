// Инлайн-дефолты концептуализации для мини-аппа: сайт ставит ConceptSkinContext
// и красится классами ds-*, мини-апп контекст не ставит и берёт отсюда. Менять
// значения нельзя — это прежний вид мини-аппа.
import type { CSSProperties } from 'react';

export const SEG_GROUP: CSSProperties = {
  display: 'inline-flex',
  gap: 'var(--space-4)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--r-14)',
  background: 'rgba(var(--fg-rgb),0.06)',
};

export function segBtn(active: boolean): CSSProperties {
  return {
    minHeight: 44,
    minWidth: 72,
    padding: '0 16px',
    borderRadius: 'var(--r-10)',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-sub)',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
  };
}

export const EYEBROW: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-sub)',
  marginBottom: 'var(--space-6)',
  paddingLeft: 2,
};

export const MODE_NAME: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontWeight: 600,
  color: 'var(--text)',
};

export const LINK_BTN: CSSProperties = {
  minHeight: 44,
  padding: '0 var(--space-6)',
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  fontSize: 13,
  cursor: 'pointer',
  textDecoration: 'underline',
};
