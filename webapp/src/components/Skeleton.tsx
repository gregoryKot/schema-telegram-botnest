// Скелетоны загрузки (правило CLAUDE.md: плейсхолдер ПО ФОРМЕ контента, а не
// спиннер). Примитив для webapp; шиммер глушится глобальным reduced-motion блоком index.css.
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

/**
 * Силуэт раздела без своего (ShellSkeletons.tsx — «Сегодня», «Ещё», кабинет): шапка страницы, лист
 * бумаги и строки списка. Аудит 2026-08-22: силуэт по форме, а не крутилка на всю высоту. На всю
 * ширину колонки (.sks-screen, index.css): в flex-ряду canvas он схлопывался в узкие пилюли (2026-11).
 */
export function ScreenSkeleton() {
  return (
    <div aria-hidden className="ds-page sks-screen">
      <div className="sks-screen-head"><Skeleton width={120} height={12} /><Skeleton width="55%" height={34} radius={10} /></div>
      <div className="pp-paper sks-screen-sheet"><Skeleton width="45%" height={20} /><Skeleton width="80%" height={12} /></div>
      <SkeletonList rows={3} height={64} />
    </div>
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
        border: '1px solid var(--line)',
        padding: '22px 20px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-12)',
        ...style,
      }}
    >
      <Skeleton width="55%" height={18} />
      <Skeleton width="90%" height={12} />
      <Skeleton width="70%" height={12} />
    </div>
  );
}

/** Список плоских плашек одной высоты — без рамки/строк (в отличие от
 * SkeletonCard), для списков строк-элементов (лента, практики). Собран
 * напрямую из Skeleton, а не из SkeletonCard: тот тяжелее (рамка +
 * внутренние строки). */
export function SkeletonList({
  rows = 4,
  height = 72,
  radius = 16,
  gap = 10,
}: {
  rows?: number;
  height?: number;
  radius?: number;
  gap?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={height} radius={radius} />
      ))}
    </div>
  );
}
