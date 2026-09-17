import type { ReactNode } from 'react';
import { haptic } from '../../haptic';

/**
 * Примитивы «тёплой бумаги»: капс-подпись секции, белый контейнер-группа и
 * строка списка внутри него. Один набор на все дневники (правило «одна
 * механика — один компонент»): иначе строка списка разъедется по пяти файлам,
 * как это уже было с оценкой потребности. Шаговые примитивы потока — рядом,
 * в diaryFlowUi.
 */

export function CapsLabel({ children }: { children: ReactNode }) {
  return (
    <div className="d-caps" style={{ marginBottom: 10 }}>
      {children}
    </div>
  );
}

/** Белый контейнер-группа: строки внутри разделяются hairline'ом. */
export function DiaryPanel({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="d-panel" style={style}>
      {children}
    </div>
  );
}

/**
 * Строка списка: название, описание, мета. Высота ≥60px, справа — шеврон
 * (ведёт дальше) либо точка (выбор в этом же экране).
 */
export function DiaryRow({
  title,
  desc,
  meta,
  trailing = 'chevron',
  selected = false,
  onClick,
}: {
  title: string;
  desc?: string;
  meta?: string;
  trailing?: 'chevron' | 'dot' | 'none';
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="d-row"
      onClick={() => {
        haptic.select();
        onClick();
      }}
      style={selected ? { background: 'var(--surface-2)' } : undefined}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.35,
          }}
        >
          {title}
        </span>
        {desc && (
          <span
            style={{
              display: 'block',
              fontSize: 13,
              color: 'var(--muted)',
              lineHeight: 1.45,
              marginTop: 3,
            }}
          >
            {desc}
          </span>
        )}
        {meta && (
          <span
            style={{
              display: 'block',
              fontSize: 12,
              color: 'var(--faint)',
              marginTop: 5,
            }}
          >
            {meta}
          </span>
        )}
      </span>
      {trailing === 'chevron' && (
        <span style={{ color: 'var(--chevron)', fontSize: 19, flexShrink: 0 }}>
          ›
        </span>
      )}
      {trailing === 'dot' && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 'var(--r-4)',
            flexShrink: 0,
            background: selected ? 'var(--accent)' : 'var(--dot)',
          }}
        />
      )}
    </button>
  );
}
