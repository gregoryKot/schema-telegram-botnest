// Инлайн-дефолты концептуализации для мини-аппа: сайт ставит ConceptSkinContext
// и красится классами ds-*, мини-апп контекст не ставит и берёт отсюда. Менять
// значения нельзя — это прежний вид мини-аппа.
import type { CSSProperties } from 'react';
import { colorMix } from '../../utils/colorMix';
import { hintStyle } from './graphStyles';

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

/** Заголовок домена в выборе схем. */
export const DOMAIN_LABEL: CSSProperties = { ...hintStyle, marginBottom: 4 };

/** Заголовок группы в выборе режимов: цветной капитель. */
export function groupLabel(color: string): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.07em',
    color: colorMix(color, 67),
    textTransform: 'uppercase',
    marginBottom: 'var(--space-6)',
    paddingLeft: 2,
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

export function schemaTag(color: string): CSSProperties {
  return {
    padding: '2px 8px',
    borderRadius: 'var(--r-20)',
    fontSize: 12,
    color: 'var(--text)',
    background: colorMix(color, 14),
  };
}

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

export const DIGEST_CAPS: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-sub)',
};

export const DIGEST_CARD: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-12)',
  background: 'var(--surface)',
  padding: 'var(--space-12) var(--space-14)',
  marginBottom: 'var(--space-16)',
};

export const DIGEST_VALUE: CSSProperties = {
  flex: '1 1 260px',
  minWidth: 0,
  margin: 0,
  fontSize: 14,
  lineHeight: 1.45,
  color: 'var(--text)',
};
