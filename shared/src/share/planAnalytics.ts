// Аналитика вкладки «План работы» карточки клиента (кабинет терапевта, правило №8).
// Парный allow-list и смысл полей — src/analytics/plan-events.constants.ts. В событие идут только
// рубрика, признак «из справочника» и статус: текст пункта и клиент — нет (правило №7).
// Имя в trackEvent — строковым литералом: так его видит трипваер analytics-sync.
import type { PlanRubric, PlanStatus } from '../therapy/plan/planItem';

export const THERAPY_PLAN_ITEM_ADDED_EVENT = 'therapy_plan_item_added';
export const THERAPY_PLAN_ITEM_STATUS_EVENT = 'therapy_plan_item_status';

interface PlanTracker {
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

/** Пункт добавлен в план; fromGuide — взят из статьи справочника. */
export function trackPlanItemAdded(
  api: PlanTracker,
  rubric: PlanRubric,
  fromGuide: boolean,
): void {
  api.trackEvent('therapy_plan_item_added', { rubric, fromGuide });
}

/** Терапевт переключил статус пункта. */
export function trackPlanItemStatus(
  api: PlanTracker,
  status: PlanStatus,
): void {
  api.trackEvent('therapy_plan_item_status', { status });
}
