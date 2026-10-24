import type { SheetsValues } from './useSheets';

// Шторки и экраны, которые рисуются ПОВЕРХ смонтированных секций (сиблинги
// AppSections в App.tsx). Пока хоть один открыт, секции получают `inert`
// (аудит 2026-09: фон читался табом и скринридером сквозь оверлей) и
// выключается свайп между разделами. Новый оверлей = ключ здесь; тест
// сверяет список с формой SheetsValues, чтобы забытый ключ был виден.
export const OVERLAY_SHEET_KEYS = [
  'about',
  'addressPicker',
  'caseFlow',
  'childhoodWheel',
  'diaries',
  'joinConfirm',
  'pairSheet',
  'plans',
  'practices',
  'schemaInfo',
  'selfMap',
  'settings',
  'todayNote',
  'tracker',
  'trackerGoal',
  'trackerOverlay',
] as const satisfies readonly (keyof SheetsValues)[];

export interface OverlayExtras {
  /** Тип открытой новой записи дневника (живёт вне useSheets), null — закрыто. */
  newDiaryEntry: string | null;
  /** Показан экран праздника серии (null — не показан). */
  celebrationStreak: number | null;
  /** Показан онбординг. */
  onboardingVisible: boolean;
}

/** true, если над секциями сейчас есть хоть один полноэкранный оверлей. */
export function isAnyOverlayOpen(
  sheets: Pick<SheetsValues, (typeof OVERLAY_SHEET_KEYS)[number]>,
  extras: OverlayExtras,
): boolean {
  return (
    OVERLAY_SHEET_KEYS.some((key) => sheets[key]) ||
    extras.newDiaryEntry !== null ||
    extras.celebrationStreak !== null ||
    extras.onboardingVisible
  );
}
