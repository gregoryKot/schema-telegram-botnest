// Ленивые обёртки четырёх главных экранов (React.lazy + Suspense).
// До этой правки TodaySection/SchemasSection/HelpSection/ProfileSection были
// статическими импортами в AppSections.tsx — весь их код (включая контент
// YSQ/needData/schemaTherapyData, который они тянут транзитивно) уезжал в
// единый стартовый чанк index.js (замер 2026-08-22: 1,26 МБ, скачивание
// 417→2055 мс на 3G + 464 мс парса, 2,3 c до первого рендера).
//
// Каждая обёртка — свой Suspense с фолбэком ПО ФОРМЕ экрана (правило
// CLAUDE.md «скелетоны, а не спиннеры»): AppSections.tsx просто меняет тег
// компонента на Lazy*, всё остальное (пропы, ErrorBoundary снаружи) — как
// было. Импорт-функции — в sectionLoaders.ts, их же зовёт preloadSections.ts
// в простое браузера.
import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';
import type { TodaySection as TodaySectionT } from '../sections/TodaySection';
import type { SchemasSection as SchemasSectionT } from '../sections/SchemasSection';
import type { HelpSection as HelpSectionT } from '../sections/HelpSection';
import type { ProfileSection as ProfileSectionT } from '../sections/ProfileSection';
import { SECTION_LOADERS } from '../utils/sectionLoaders';
import { TodayScreenSkeleton, ScreenSkeleton } from './Skeleton';

const RealToday = lazy(() =>
  SECTION_LOADERS.today().then((m) => ({ default: m.TodaySection })),
);
const RealSchemas = lazy(() =>
  SECTION_LOADERS.schemas().then((m) => ({ default: m.SchemasSection })),
);
const RealHelp = lazy(() =>
  SECTION_LOADERS.help().then((m) => ({ default: m.HelpSection })),
);
const RealProfile = lazy(() =>
  SECTION_LOADERS.profile().then((m) => ({ default: m.ProfileSection })),
);

export function LazyTodaySection(props: ComponentProps<typeof TodaySectionT>) {
  return (
    <Suspense fallback={<TodayScreenSkeleton />}>
      <RealToday {...props} />
    </Suspense>
  );
}

export function LazySchemasSection(
  props: ComponentProps<typeof SchemasSectionT>,
) {
  return (
    <Suspense fallback={<ScreenSkeleton cards={3} />}>
      <RealSchemas {...props} />
    </Suspense>
  );
}

export function LazyHelpSection(props: ComponentProps<typeof HelpSectionT>) {
  return (
    <Suspense fallback={<ScreenSkeleton cards={3} />}>
      <RealHelp {...props} />
    </Suspense>
  );
}

export function LazyProfileSection(
  props: ComponentProps<typeof ProfileSectionT>,
) {
  return (
    <Suspense fallback={<ScreenSkeleton cards={4} />}>
      <RealProfile {...props} />
    </Suspense>
  );
}
