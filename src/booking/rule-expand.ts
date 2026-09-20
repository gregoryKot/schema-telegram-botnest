import { localMidnightUTC } from '../utils/tz';

// Чистая арифметика развёртки AvailabilityRule в конкретные слоты одного
// календарного дня. Раньше жила инлайн в цикле SlotService.getSlots — теперь
// общий хелпер для публичного /slots И для admin-calendar.ts (правило «одна
// механика — один компонент», контракт «Календарь слотов в админке»).

export interface RuleSlot {
  startsAt: Date;
  endsAt: Date;
}

/** Поля AvailabilityRule, нужные для развёртки (без id/isActive/dayOfWeek —
 *  день уже выбран вызывающим через dateStr). */
export interface ExpandableRule {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  sessionDuration: number;
  bufferMin: number;
  timezone: string;
}

/**
 * Слоты правила на календарный день dateStr (YYYY-MM-DD, в зоне правила).
 * Шаг — sessionDuration+bufferMin, слот входит только если t+sessionDuration
 * укладывается в конец окна (полуоткрытый интервал, границы включительно).
 */
export function expandRuleForDay(
  rule: ExpandableRule,
  dateStr: string,
): RuleSlot[] {
  const dayStartMs = localMidnightUTC(dateStr, rule.timezone).getTime();
  const slotStartMs =
    dayStartMs + (rule.startHour * 60 + rule.startMinute) * 60_000;
  const slotEndMs = dayStartMs + (rule.endHour * 60 + rule.endMinute) * 60_000;
  const step = (rule.sessionDuration + rule.bufferMin) * 60_000;
  const sessionMs = rule.sessionDuration * 60_000;

  const slots: RuleSlot[] = [];
  for (let t = slotStartMs; t + sessionMs <= slotEndMs; t += step) {
    slots.push({ startsAt: new Date(t), endsAt: new Date(t + sessionMs) });
  }
  return slots;
}

/** День недели (0=Sun…6=Sat) календарной строки — не момента: подставляем
 *  полночь UTC, чтобы дата не зависела от зоны процесса (правило №25). */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/** Календарная строка +n дней (n может быть отрицательным). Арифметика в
 *  UTC-сутках — как и весь остальной разбор календарных строк проекта. */
export function addDaysToDateString(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
