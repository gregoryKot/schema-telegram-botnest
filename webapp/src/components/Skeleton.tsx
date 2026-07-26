// Скелетоны загрузки (правило CLAUDE.md: плейсхолдер ПО ФОРМЕ контента, а не
// спиннер). Примитив для webapp — аналог schema-miniapp/src/components/
// Skeleton.tsx; шиммер глушится глобальным reduced-motion блоком index.css.
import type { CSSProperties } from 'react';

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="skel"
      aria-hidden
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** Карточка-силуэт: строка-заголовок + строки текста, размеры под контент. */
export function SkeletonCard({
  height = 120,
  radius = 22,
  style,
}: {
  height?: number;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        height,
        borderRadius: radius,
        border: '1px solid rgba(255,255,255,.08)',
        padding: '22px 20px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      <Skeleton width="55%" height={18} />
      <Skeleton width="90%" height={12} />
      <Skeleton width="70%" height={12} />
    </div>
  );
}
