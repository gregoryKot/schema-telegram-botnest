// Ленивые обёртки трёх дневниковых шитов AppDiaryNav (React.lazy + Suspense,
// тот же паттерн, что LazyOverlays.tsx). До этой правки они были статическими
// импортами AppDiaryNav → AppOverlays → App: замер 2026-08-23 показал, что
// через них в стартовый eager-граф затянуты GratitudeEntrySheet.js (62 КБ),
// modeCards.js (51 КБ, весь контент карточек режимов) и healthyAdultHints.js
// (23 КБ) — три из самых тяжёлых файлов очереди предзагрузки холодного
// старта, при том что ни один не нужен до нажатия «+».
//
// Чтобы первое нажатие «+» не ждало сеть, чанки прогреваются в простое
// после старта — см. DIARY_SHEET_LOADERS + preloadDiarySheets ниже (тот же
// урок, что sectionLoaders.ts: lazy() и прогрев зовут ОДИН литерал import(),
// иначе бандлер не разделит с ними закешированный Promise).
import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';
import type { SchemaEntrySheet as SchemaEntrySheetT } from './diary/SchemaEntrySheet';
import type { ModeEntrySheet as ModeEntrySheetT } from './diary/ModeEntrySheet';
import type { GratitudeEntrySheet as GratitudeEntrySheetT } from './diary/GratitudeEntrySheet';
import { BottomSheet } from './BottomSheet';
import { ScreenSkeleton } from './Skeleton';
import { onIdle } from '../utils/preloadSections';

export const DIARY_SHEET_LOADERS = {
  schema: () => import('./diary/SchemaEntrySheet'),
  mode: () => import('./diary/ModeEntrySheet'),
  gratitude: () => import('./diary/GratitudeEntrySheet'),
} as const;

const RealSchemaEntrySheet = lazy(() =>
  DIARY_SHEET_LOADERS.schema().then((m) => ({ default: m.SchemaEntrySheet })),
);
const RealModeEntrySheet = lazy(() =>
  DIARY_SHEET_LOADERS.mode().then((m) => ({ default: m.ModeEntrySheet })),
);
const RealGratitudeEntrySheet = lazy(() =>
  DIARY_SHEET_LOADERS.gratitude().then((m) => ({
    default: m.GratitudeEntrySheet,
  })),
);

/** Прогрев чанков дневниковых шитов в простое — по одному, после прогрева
 * секций (вызывается из App.tsx следом за preloadOtherSections). Возвращает
 * список для теста, как preloadOtherSections. */
export function preloadDiarySheets(): (keyof typeof DIARY_SHEET_LOADERS)[] {
  const kinds = Object.keys(
    DIARY_SHEET_LOADERS,
  ) as (keyof typeof DIARY_SHEET_LOADERS)[];
  function loadNext(index: number): void {
    if (index >= kinds.length) return;
    onIdle(() => {
      // Фоновая догрузка: при ошибке (офлайн) чанк доедет обычным путём
      // через React.lazy при реальном открытии шита.
      void DIARY_SHEET_LOADERS[kinds[index]]().finally(() =>
        loadNext(index + 1),
      );
    });
  }
  loadNext(0);
  return kinds;
}

export function LazySchemaEntrySheet(
  props: ComponentProps<typeof SchemaEntrySheetT>,
) {
  return (
    <Suspense
      fallback={
        <BottomSheet onClose={props.onClose}>
          <ScreenSkeleton cards={2} />
        </BottomSheet>
      }
    >
      <RealSchemaEntrySheet {...props} />
    </Suspense>
  );
}

export function LazyModeEntrySheet(
  props: ComponentProps<typeof ModeEntrySheetT>,
) {
  return (
    <Suspense
      fallback={
        <BottomSheet onClose={props.onClose}>
          <ScreenSkeleton cards={2} />
        </BottomSheet>
      }
    >
      <RealModeEntrySheet {...props} />
    </Suspense>
  );
}

export function LazyGratitudeEntrySheet(
  props: ComponentProps<typeof GratitudeEntrySheetT>,
) {
  return (
    <Suspense
      fallback={
        <BottomSheet onClose={props.onClose}>
          <ScreenSkeleton cards={2} />
        </BottomSheet>
      }
    >
      <RealGratitudeEntrySheet {...props} />
    </Suspense>
  );
}
