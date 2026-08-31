// Ленивые обёртки тяжёлых шторок AppOverlays.tsx (React.lazy + Suspense).
// До этой правки DiarySection/PracticesScreen/PlansScreen/SchemaInfoSheet
// (несёт в себе YSQTestSheet — 116 вопросов, ~16 КБ текста)/ChildhoodWheelSheet/
// TaskCreateSheet были статическими импортами — их код ехал в стартовый чанк
// index.js, даже если пользователь ни разу их не открывал (замер 2026-08-22:
// 1,26 МБ, 2,3 c до первого рендера на 3G). Мелкие подтверждения
// (Disclaimer, AddressFormPicker, Celebration, NoteSheet, PairSheet,
// JoinConfirmSheet, AboutSheet, SettingsSheet, TrackerOverlay) не трогаем —
// они либо мгновенно нужны в основном сценарии (оценка/настройки), либо
// действительно маленькие.
//
// У каждой шторки — свой Suspense: загрузка одной не гасит экран под ней и
// не блокирует остальные. Шторки на BottomSheet показывают знакомую рамку
// сразу (BottomSheet сам по себе лёгкий и остаётся eager), а скелетон — только
// внутри неё, по форме будущего контента (правило CLAUDE.md).
import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';
import type { DiarySection as DiarySectionT } from '../sections/DiarySection';
import type { PracticesScreen as PracticesScreenT } from './PracticesScreen';
import type { PlansScreen as PlansScreenT } from './PlansScreen';
import type { SchemaInfoSheet as SchemaInfoSheetT } from './SchemaInfoSheet';
import type { ChildhoodWheelSheet as ChildhoodWheelSheetT } from './ChildhoodWheelSheet';
import type { TaskCreateSheet as TaskCreateSheetT } from './TaskCreateSheet';
import type { CaseFlowSheet as CaseFlowSheetT } from './caseFlow/CaseFlowSheet';
import type { SelfMapScreen as SelfMapScreenT } from './selfMap/SelfMapScreen';
import { BottomSheet } from './BottomSheet';
import { ScreenSkeleton } from './Skeleton';

const RealDiarySection = lazy(() =>
  import('../sections/DiarySection').then((m) => ({
    default: m.DiarySection,
  })),
);
const RealPracticesScreen = lazy(() =>
  import('./PracticesScreen').then((m) => ({ default: m.PracticesScreen })),
);
const RealPlansScreen = lazy(() =>
  import('./PlansScreen').then((m) => ({ default: m.PlansScreen })),
);
const RealSchemaInfoSheet = lazy(() =>
  import('./SchemaInfoSheet').then((m) => ({ default: m.SchemaInfoSheet })),
);
const RealChildhoodWheelSheet = lazy(() =>
  import('./ChildhoodWheelSheet').then((m) => ({
    default: m.ChildhoodWheelSheet,
  })),
);
const RealTaskCreateSheet = lazy(() =>
  import('./TaskCreateSheet').then((m) => ({ default: m.TaskCreateSheet })),
);

export function LazyDiarySection(props: ComponentProps<typeof DiarySectionT>) {
  return (
    <Suspense fallback={<ScreenSkeleton cards={3} />}>
      <RealDiarySection {...props} />
    </Suspense>
  );
}

export function LazyPracticesScreen(
  props: ComponentProps<typeof PracticesScreenT>,
) {
  return (
    <Suspense fallback={<ScreenSkeleton cards={4} />}>
      <RealPracticesScreen {...props} />
    </Suspense>
  );
}

export function LazyPlansScreen(props: ComponentProps<typeof PlansScreenT>) {
  return (
    <Suspense fallback={<ScreenSkeleton cards={4} />}>
      <RealPlansScreen {...props} />
    </Suspense>
  );
}

export function LazySchemaInfoSheet(
  props: ComponentProps<typeof SchemaInfoSheetT>,
) {
  return (
    <Suspense
      fallback={
        <BottomSheet onClose={props.onClose}>
          <ScreenSkeleton cards={3} />
        </BottomSheet>
      }
    >
      <RealSchemaInfoSheet {...props} />
    </Suspense>
  );
}

export function LazyChildhoodWheelSheet(
  props: ComponentProps<typeof ChildhoodWheelSheetT>,
) {
  return (
    <Suspense
      fallback={
        <BottomSheet onClose={props.onClose}>
          <ScreenSkeleton cards={2} />
        </BottomSheet>
      }
    >
      <RealChildhoodWheelSheet {...props} />
    </Suspense>
  );
}

export function LazyTaskCreateSheet(
  props: ComponentProps<typeof TaskCreateSheetT>,
) {
  return (
    <Suspense
      fallback={
        <BottomSheet onClose={props.onClose}>
          <ScreenSkeleton cards={2} />
        </BottomSheet>
      }
    >
      <RealTaskCreateSheet {...props} />
    </Suspense>
  );
}

// Разбор случая и карта себя — самые тяжёлые новые экраны (десять шагов
// потока и вся сборка карты). В стартовый чанк им попадать незачем: разбор
// открывается по явному нажатию, карта — ещё позже.
const RealCaseFlowSheet = lazy(() =>
  import('./caseFlow/CaseFlowSheet').then((m) => ({
    default: m.CaseFlowSheet,
  })),
);

const RealSelfMapScreen = lazy(() =>
  import('./selfMap/SelfMapScreen').then((m) => ({
    default: m.SelfMapScreen,
  })),
);

export function LazyCaseFlowSheet(
  props: ComponentProps<typeof CaseFlowSheetT>,
) {
  return (
    <Suspense
      fallback={
        <BottomSheet onClose={props.onClose}>
          <ScreenSkeleton cards={2} />
        </BottomSheet>
      }
    >
      <RealCaseFlowSheet {...props} />
    </Suspense>
  );
}

export function LazySelfMapScreen(
  props: ComponentProps<typeof SelfMapScreenT>,
) {
  return (
    <Suspense
      fallback={
        <BottomSheet onClose={props.onClose}>
          <ScreenSkeleton cards={3} />
        </BottomSheet>
      }
    >
      <RealSelfMapScreen {...props} />
    </Suspense>
  );
}
