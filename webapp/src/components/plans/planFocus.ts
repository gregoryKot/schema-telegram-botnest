// План, к которому привёл общий поиск: «История планов» грузит период до его дня и подсвечивает строку.
import { dateStringMs, isCalendarDate } from '../../../../shared/src/utils/calendarDate';

export interface PlanFocus { id: number; date: string }

/** Обычный вход в «Историю планов». */
export const PLAN_HISTORY_DAYS = 30;
/** Потолок ручки истории (src/api/plans.controller.ts). */
export const PLAN_HISTORY_MAX_DAYS = 365;

/** Цель из состояния маршрута; чужая форма — null. */
export function planFocusOf(value: unknown): PlanFocus | null {
  const v = value as { id?: unknown; date?: unknown } | null | undefined;
  return typeof v?.id === 'number' && typeof v.date === 'string' && isCalendarDate(v.date) ? { id: v.id, date: v.date } : null;
}

/** Сколько дней истории просить, чтобы день плана попал в ответ; запас в два дня — на пояс сервера. */
export function planHistoryDays(focus: PlanFocus | null | undefined, today: string): number {
  if (!focus) return PLAN_HISTORY_DAYS;
  const back = Math.round((dateStringMs(today) - dateStringMs(focus.date)) / 86_400_000) + 2;
  return Math.min(Math.max(back, PLAN_HISTORY_DAYS), PLAN_HISTORY_MAX_DAYS);
}
