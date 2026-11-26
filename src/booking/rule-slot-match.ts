import { localDate } from '../utils/tz';
import {
  expandRuleForDay,
  weekdayOf,
  type ExpandableRule,
} from './rule-expand';

// «Сервер предлагает ровно этот слот» — проверка брони против сетки правила.
// Раньше POST /api/booking/book проверял только «интервал влезает в окно»
// (ruleCoversSlot), и INTRO_15 на 180 минут или старт 10:30 при сетке
// 10:00/11:00 проходили. Развёртка — та же expandRuleForDay, что у
// SlotService.getSlots (одна механика — один модуль), местная дата — по зоне
// правила, как там же.

export interface OfferingRule extends ExpandableRule {
  dayOfWeek: number;
}

/**
 * Правило предлагает слот [startsAt, startsAt+durationMin): длительность —
 * ровно sessionDuration правила, местный день недели совпадает, а startsAt
 * лежит на сетке слотов этого дня.
 */
export function ruleOffersSlot(
  rule: OfferingRule,
  startsAt: Date,
  durationMin: number,
): boolean {
  if (durationMin !== rule.sessionDuration) return false;
  const dateStr = localDate(rule.timezone, startsAt);
  if (rule.dayOfWeek !== weekdayOf(dateStr)) return false;
  const at = startsAt.getTime();
  return expandRuleForDay(rule, dateStr).some(
    (s) => s.startsAt.getTime() === at,
  );
}
