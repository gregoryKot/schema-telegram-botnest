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
 * Оболочка плашки «Обычно в методе»: подпись, текст (цель режима или строка
 * группы), «Взять за основу» и, у режима со своим разделом, всё остальное.
 */
export function MethodHint({
  text,
  take,
  children,
}: {
  text: string;
  take: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        margin: '0 0 var(--space-6)',
        padding: 'var(--space-8) var(--space-12)',
        borderRadius: 'var(--r-12)',
        background: 'rgba(var(--fg-rgb),0.04)',
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
