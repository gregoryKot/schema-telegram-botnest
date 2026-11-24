import type { CSSProperties, ReactNode } from 'react';
import { btn, card } from '../shared';
import { Skeleton } from '../../../components/Skeleton';

/** Одна строка вверху вкладки: что здесь видно. */
export function Hint({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.5 }}>{children}</p>;
}

export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--accent-red)', fontSize: 14 }}>{message}</span>
      <button type="button" style={{ ...btn, minHeight: 44 }} onClick={onRetry}>Повторить</button>
    </div>
  );
}

export const EmptyNote = ({ children = 'Пока нет данных' }: { children?: ReactNode }) => (
  <p style={{ color: 'var(--text-sub)', fontSize: 14, margin: '8px 0' }}>{children}</p>
);

export function Title({ children }: { children: ReactNode }) {
  return <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{children}</h3>;
}

interface PillsProps<T extends string | number> {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}

/** Переключатель-«таблетки»: тап-цель ≥44, выбранная отмечена aria-pressed. */
export function Pills<T extends string | number>({ items, value, onChange, label }: PillsProps<T>) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((it) => {
        const on = it.id === value;
        const style: CSSProperties = {
          minHeight: 44, minWidth: 44, padding: '0 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          borderRadius: 100, background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--on-accent)' : 'var(--text-sub)',
          border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
        };
        return <button key={it.id} type="button" aria-pressed={on} style={style} onClick={() => onChange(it.id)}>{it.label}</button>;
      })}
    </div>
  );
}

/** Горизонтальная полоса: ширина — доля от максимума. */
export function Bar({ pct, muted }: { pct: number; muted?: boolean }) {
  return (
    <div aria-hidden style={{ height: 8, borderRadius: 4, background: 'color-mix(in srgb, var(--text-sub) 14%, transparent)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: muted ? 'var(--line-strong)' : 'var(--accent)' }} />
    </div>
  );
}

/** Скелетон по форме: n карточек заданной высоты. */
export function CardsSkeleton({ count = 3, height = 120 }: { count?: number; height?: number }) {
  return (
    <div aria-hidden className="u-col12">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} radius={14} />)}
    </div>
  );
}
