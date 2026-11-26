// Какие быстрые действия «плюса» сайт открывает оверлеем-листом (остальное —
// tracker — идёт через существующий флаг трекера в useOverlays). Реестр
// действий общий (shared/src/quickActions), здесь только решение площадки.
import type { QuickActionId } from '../../../../shared/src/quickActions/quickActions';

export const OVERLAY_QUICK_ACTIONS = [
  'case',
  'diary_schema',
  'diary_mode',
  'diary_gratitude',
  'breathing',
  'grounding',
  'stop',
] as const;
export type OverlayQuickActionId = (typeof OVERLAY_QUICK_ACTIONS)[number];

export function isOverlayQuickAction(id: QuickActionId): id is OverlayQuickActionId {
  return (OVERLAY_QUICK_ACTIONS as readonly string[]).includes(id);
}
