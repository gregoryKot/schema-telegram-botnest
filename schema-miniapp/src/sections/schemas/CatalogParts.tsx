import { pressable } from '../../utils/a11y';
import { hex } from './utils';

// Скелетон чип-строки и заголовок группы каталога — общие для вкладок
// «Схемы» и «Режимы» (правило «одна механика — один компонент»)
export function ChipsSkeleton({ widths }: { widths: number[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {widths.map((w, i) => (
        <div
          key={i}
          style={{
            height: 32,
            width: w,
            borderRadius: 20,
            background:
              'linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%)',
            backgroundSize: '200% auto',
            animation: 'shimmer 1.5s linear infinite',
          }}
        />
      ))}
    </div>
  );
}

export function CatalogHeader({
  color,
  name,
  count,
  open,
  onToggle,
}: {
  color: string;
  name: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      {...pressable(onToggle)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: hex(color),
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {name}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 14,
            color: 'var(--text-faint)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
        <span
          style={{
            color: 'var(--text-faint)',
            fontSize: 14,
            display: 'inline-block',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ›
        </span>
      </div>
    </div>
  );
}
