// Скелетоны загрузки (правило CLAUDE.md «Скелетоны, а не спиннеры»): пока
// грузятся данные — показываем плейсхолдеры ПО ФОРМЕ будущего контента, а не
// котика-спиннер и не пустоту. Меньше сенсорного скачка при появлении данных
// (нейроинклюзивность) и ощущение, что экран уже «на месте».
//
// Skeleton — примитив-плашка. Композиты (TodayScreenSkeleton и т.п.) собирают
// из него силуэт конкретного экрана. Шиммер глушится reduced-motion блоком CSS.
import { useSafeTop } from '../utils/safezone';

export function Skeleton({
  w = '100%',
  h = 14,
  radius = 8,
  circle,
  style,
}: {
  w?: number | string;
  h?: number | string;
  radius?: number;
  circle?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        width: circle ? h : w,
        height: h,
        borderRadius: circle ? '50%' : radius,
        flexShrink: 0,
        background:
          'linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%)',
        backgroundSize: '200% auto',
        animation: 'shimmer 1.5s linear infinite',
        ...style,
      }}
    />
  );
}

/** Силуэт карточки (rounded-блок высотой h). */
export function SkeletonCard({ h = 120 }: { h?: number }) {
  return <Skeleton h={h} radius={20} />;
}

/** Несколько строк текста разной длины. */
export function SkeletonLines({
  widths = ['80%', '65%', '90%'],
}: {
  widths?: (number | string)[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {widths.map((w, i) => (
        <Skeleton key={i} w={w} h={12} radius={6} />
      ))}
    </div>
  );
}

/** Список карточек одной высоты — для экранов/листов со списком (практики,
 * планы, заметки, клиенты). Форма совпадает с будущими строками списка. */
export function SkeletonList({
  rows = 4,
  h = 72,
  gap = 10,
}: {
  rows?: number;
  h?: number;
  gap?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} h={h} />
      ))}
    </div>
  );
}

/** Силуэт экрана «Сегодня»: шапка + крупная CTA + подсказка «что ещё». */
export function TodayScreenSkeleton() {
  const safeTop = useSafeTop();
  return (
    <div style={{ minHeight: '100vh', paddingTop: safeTop }}>
      <div style={{ padding: '24px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton w="62%" h={22} radius={8} />
            <Skeleton w="45%" h={12} radius={6} style={{ marginTop: 8 }} />
          </div>
          <Skeleton w={44} h={44} radius={14} />
        </div>
      </div>
      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <SkeletonCard h={56} />
        <SkeletonCard h={168} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '6px 0',
          }}
        >
          <Skeleton w={160} h={14} radius={7} />
        </div>
      </div>
    </div>
  );
}

/** Универсальный силуэт раздела: заголовок + N карточек. */
export function ScreenSkeleton({ cards = 3 }: { cards?: number }) {
  const safeTop = useSafeTop();
  return (
    <div style={{ minHeight: '100vh', paddingTop: safeTop }}>
      <div style={{ padding: '24px 20px 4px' }}>
        <Skeleton w="45%" h={24} radius={8} />
        <Skeleton w="60%" h={12} radius={6} style={{ marginTop: 8 }} />
      </div>
      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} h={i === 0 ? 150 : 84} />
        ))}
      </div>
    </div>
  );
}
