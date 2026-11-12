import type { CSSProperties, ReactNode } from 'react';
import { hintStyle, labelStyle } from './graphStyles';

/** «Взять за основу» — единственный акцент плашки. */
export const takeStyle: CSSProperties = {
  minHeight: 44,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

/**
 * Оболочка плашки «Обычно в методе»: подпись, текст (цель режима или схемы,
 * строка группы), «Взять за основу» (только у режима) и, у раздела
 * справочника, всё остальное.
 */
export function MethodHint({
  text,
  take,
  children,
}: {
  text: string;
  take?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        margin: '0 0 var(--space-8)',
        padding: 'var(--space-12) var(--space-14)',
        borderRadius: 'var(--r-14)',
        background: 'color-mix(in srgb, var(--surface) 55%, transparent)',
      }}
    >
      <div style={labelStyle}>Обычно в методе</div>
      <div style={{ ...hintStyle, color: 'var(--text)', margin: '2px 0' }}>
        {text}
      </div>
      {take}
      {children}
    </div>
  );
}
