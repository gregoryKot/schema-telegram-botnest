// Тексты экрана «Планы» — одни на сайт и мини-апп (правило №3).
// QA 2026-11 (B-М8): пустой экран обещал кнопку «Запланировать практику»,
// которой нет ни на одной площадке; настоящий путь шёл через трекер и ответ
// «Совсем нет». Теперь пустой экран сам предлагает выбрать потребность и
// открывает лист плана (PlansScreen обеих площадок).
import type { Tr } from '../needs/types';
import { pluralRu } from '../utils/pluralRu';
import { todayStr } from '../utils/format';
import { formatDateString, shiftCalendarDay } from '../utils/calendarDate';

/** Подпись пустого экрана: что такое план и что нажать первым. */
export const plansEmptyText = (tr: Tr): string =>
  tr(
    'План — один маленький шаг на завтра для одной из пяти потребностей, с напоминанием. Выбери, о какой позаботиться:',
    'План — один маленький шаг на завтра для одной из пяти потребностей, с напоминанием. Выберите, о какой позаботиться:',
  );

/** «1 активный · 2 завершённых» — числа со словами по правилам склонения. */
export function plansSummary(pending: number, completed: number): string {
  const active = pluralRu(pending, 'активный', 'активных', 'активных');
  const done = pluralRu(completed, 'завершённый', 'завершённых', 'завершённых');
  return `${pending} ${active} · ${completed} ${done}`;
}

/**
 * Подпись дня плана. `scheduledDate` сервер пишет МЕСТНЫМ днём человека
 * («завтра» по `notifyTimezone`, `src/api/plans.controller.ts`), поэтому
 * «Сегодня»/«Завтра» сверяются с местным днём устройства (`todayStr`), а не с
 * днём UTC; прочие дни показываются как есть, без сдвига зоной (правило №25).
 * Раньше в Сиднее до 10 утра «Сегодня» стояло у вчерашнего плана, а в
 * Лос-Анджелесе `new Date('YYYY-MM-DD')` показывал предыдущее число.
 */
export function planDateLabel(day: string, now: Date = new Date()): string {
  const today = todayStr(now);
  if (day === today) return 'Сегодня';
  if (day === shiftCalendarDay(today, 1)) return 'Завтра';
  return formatDateString(day, { day: 'numeric', month: 'short' });
}
