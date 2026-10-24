// Проверка «слот попадает в окно ОДНОГО правила» — вынесена из
// booking.availability.ts (правило №10, файл упирался в потолок бейслайна).
// Используется и assertWithinAvailability (rules.some(...)), и
// admin-calendar.ts (обратный вопрос: какая ячейка чем покрыта).

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface RuleWindow {
  dayOfWeek: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  timezone: string;
}

/**
 * Слот [startsAt, startsAt+durationMin) целиком попадает в день недели и
 * часы окна rule — время читается в ЕГО таймзоне (formatToParts, не UTC).
 */
export function ruleCoversSlot(
  rule: RuleWindow,
  startsAt: Date,
  durationMin: number,
): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: rule.timezone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(startsAt);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = WEEKDAYS.indexOf(get('weekday'));
  if (day !== rule.dayOfWeek) return false;
  const startMin = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
  const winStart = rule.startHour * 60 + rule.startMinute;
  const winEnd = rule.endHour * 60 + rule.endMinute;
  return startMin >= winStart && startMin + durationMin <= winEnd;
}
