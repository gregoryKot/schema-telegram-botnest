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
