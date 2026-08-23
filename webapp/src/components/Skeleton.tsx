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

/**
 * Силуэт целого экрана (шапка + карточки) — фолбэк для Suspense-границы
 * основного контента AppShell (переключение раздела / вход в кабинет
 * терапевта). Аудит 2026-08-22: раньше единый Suspense на весь canvas ронял
 * ЛЮБУЮ ленивую шторку в общий крутилка-на-всю-высоту `Loader`; для замены
 * основного контента (не шторки поверх) правило CLAUDE.md требует силуэт по
 * форме, а не спиннер.
 */
export function ScreenSkeleton() {
  return (
    <div aria-hidden style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
      <Skeleton width="45%" height={22} style={{ marginBottom: 4 }} />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard height={80} />
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
        border: '1px solid rgba(255,255,255,.08)',
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
