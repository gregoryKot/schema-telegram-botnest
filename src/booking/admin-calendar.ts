import { localMidnightUTC } from '../utils/tz';
import {
  expandRuleForDay,
  weekdayOf,
  addDaysToDateString,
  ExpandableRule,
} from './rule-expand';
import { overlapsInterval, overrideInterval, Interval } from './slot-filters';
import { MIN_BOOK_LEAD_HOURS } from './booking.config';

// Чистая сборка недельного календаря админки: правила расписания + ручной
// слой SlotOverride + брони + занятость календаря → сетка ячеек по дням.
// Алгоритм — контракт «Календарь слотов в админке», пункты 1–7. Ничего не
// ходит в БД — все данные приходят готовыми от AdminCalendarService.

export type AdminCalendarCellState =
  'free' | 'off' | 'blocked' | 'extra' | 'busy' | 'booked';

export interface AdminCalendarCell {
  startsAt: string; // ISO UTC
  durationMin: number;
  state: AdminCalendarCellState;
  busy: boolean;
  past: boolean;
  booking?: { id: number; clientName: string; status: 'HELD' | 'CONFIRMED' };
  // startsAt строки SlotOverride, породившей blocked/extra. Для blocked может
  // отличаться от startsAt ячейки: BLOCK действует по пересечению, и после
  // правки правила (сдвиг сетки) ячейки и блок расходятся по времени — clear
  // по startsAt ячейки не нашёл бы строку, и «открыть» молча не срабатывал бы.
  overrideStartsAt?: string;
}

export interface AdminCalendarDay {
  date: string; // YYYY-MM-DD
  cells: AdminCalendarCell[];
}

export interface AdminCalendarRuleInput extends ExpandableRule {
  dayOfWeek: number;
}

export interface AdminCalendarOverrideInput {
  kind: 'BLOCK' | 'OPEN';
  startsAt: Date;
  durationMin: number;
}

export interface AdminCalendarBookingInput {
  id: number;
  startsAt: Date;
  durationMin: number;
  clientName: string;
  status: 'HELD' | 'CONFIRMED';
}

export interface BuildAdminCalendarInput {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD, включительно
  timezone: string; // якорь фоновой оси и границ дня (не у каждого правила своя)
  rules: AdminCalendarRuleInput[]; // уже отфильтрованы по isActive вызывающим
  overrides: AdminCalendarOverrideInput[];
  bookings: AdminCalendarBookingInput[];
  busy: Interval[];
  calendarBlocking: boolean;
  now: Date;
}

interface WorkingCell {
  startsAt: Date;
  durationMin: number;
  fromRule: boolean; // отличает «ячейку правила» (fallback→free) от фоновой (fallback→off)
}

interface Axis {
  startMin: number; // минут от полуночи
  endMin: number;
  stepMin: number;
  durationMin: number;
}

// Правил нет вообще — фон 09:00–18:00 шагом 60 мин по 50 (значения по умолчанию продукта).
const DEFAULT_AXIS: Axis = {
  startMin: 9 * 60,
  endMin: 18 * 60,
  stepMin: 60,
  durationMin: 50,
};

export function buildAdminCalendar(
  input: BuildAdminCalendarInput,
): AdminCalendarDay[] {
  const earliest = input.now.getTime() + MIN_BOOK_LEAD_HOURS * 3_600_000;
  const axis = computeAxis(input.rules);
  const days: AdminCalendarDay[] = [];
  for (let d = input.from; d <= input.to; d = addDaysToDateString(d, 1)) {
    days.push(buildDay(d, axis, earliest, input));
  }
  return days;
}

/** Общая ось фона (шаг 2 контракта): окно — min/max часов по ВСЕМ активным
 *  правилам любого дня недели; шаг/длительность — у самого частого правила
 *  (по sessionDuration+bufferMin, при равенстве — у встретившегося первым). */
function computeAxis(rules: AdminCalendarRuleInput[]): Axis {
  if (!rules.length) return DEFAULT_AXIS;
  let startMin = Infinity;
  let endMin = -Infinity;
  const byStep = new Map<
    number,
    { count: number; rule: AdminCalendarRuleInput }
  >();
  for (const r of rules) {
    startMin = Math.min(startMin, r.startHour * 60 + r.startMinute);
    endMin = Math.max(endMin, r.endHour * 60 + r.endMinute);
    const key = r.sessionDuration + r.bufferMin;
    const entry = byStep.get(key);
    if (entry) entry.count += 1;
    else byStep.set(key, { count: 1, rule: r });
  }
  let best = [...byStep.values()][0];
  for (const entry of byStep.values())
    if (entry.count > best.count) best = entry;
  return {
    startMin,
    endMin,
    stepMin: best.rule.sessionDuration + best.rule.bufferMin,
    durationMin: best.rule.sessionDuration,
  };
}

function buildDay(
  dateStr: string,
  axis: Axis,
  earliest: number,
  input: BuildAdminCalendarInput,
): AdminCalendarDay {
  const cells = new Map<number, WorkingCell>(); // key = startsAt.getTime()
  const dow = weekdayOf(dateStr);

  // 1) ячейки правил этого дня недели.
  for (const rule of input.rules) {
    if (rule.dayOfWeek !== dow) continue;
    for (const slot of expandRuleForDay(rule, dateStr)) {
      const key = slot.startsAt.getTime();
      if (!cells.has(key)) {
        cells.set(key, {
          startsAt: slot.startsAt,
          durationMin: rule.sessionDuration,
          fromRule: true,
        });
      }
    }
  }

  // 2) фоновые off-ячейки по общей оси — только там, где нет ячейки правила.
  const ruleIntervals = [...cells.values()].map(toInterval);
  const dayStartMs = localMidnightUTC(dateStr, input.timezone).getTime();
  const axisEndMs = dayStartMs + axis.endMin * 60_000;
  const sessionMs = axis.durationMin * 60_000;
  for (
    let t = dayStartMs + axis.startMin * 60_000;
    t + sessionMs <= axisEndMs;
    t += axis.stepMin * 60_000
  ) {
    const startsAt = new Date(t);
    const endsAt = new Date(t + sessionMs);
    if (overlapsInterval(startsAt, endsAt, ruleIntervals)) continue;
    if (!cells.has(t)) {
      cells.set(t, {
        startsAt,
        durationMin: axis.durationMin,
        fromRule: false,
      });
    }
  }

  // 3) ячейки из overrides — startsAt ещё не занят ни одной ячейкой выше.
  for (const o of input.overrides) {
    if (!inDay(o.startsAt, dateStr, input.timezone)) continue;
    const key = o.startsAt.getTime();
    if (!cells.has(key)) {
      cells.set(key, {
        startsAt: o.startsAt,
        durationMin: o.durationMin,
        fromRule: false,
      });
    }
  }

  // 4) ячейки из броней — бронь обязана быть видна всегда, даже вне сетки.
  for (const b of input.bookings) {
    if (!inDay(b.startsAt, dateStr, input.timezone)) continue;
    const key = b.startsAt.getTime();
    if (!cells.has(key)) {
      cells.set(key, {
        startsAt: b.startsAt,
        durationMin: b.durationMin,
        fromRule: false,
      });
    }
  }

  const sorted = [...cells.values()].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
  return {
    date: dateStr,
    cells: sorted.map((c) => resolveCell(c, earliest, input)),
  };
}

/** Пункт 6 контракта: busy/booking/override → state по приоритету
 *  booked > blocked > busy(если calendarBlocking) > extra > free > off. */
function resolveCell(
  cell: WorkingCell,
  earliest: number,
  input: BuildAdminCalendarInput,
): AdminCalendarCell {
  const end = new Date(cell.startsAt.getTime() + cell.durationMin * 60_000);
  const booking = input.bookings.find((b) =>
    overlapsInterval(cell.startsAt, end, [toInterval(b)]),
  );
  const blockedBy = input.overrides.find(
    (o) =>
      o.kind === 'BLOCK' &&
      overlapsInterval(cell.startsAt, end, [overrideInterval(o)]),
  );
  const exact = input.overrides.find(
    (o) => o.startsAt.getTime() === cell.startsAt.getTime(),
  );
  const busyHit = overlapsInterval(cell.startsAt, end, input.busy);

  let state: AdminCalendarCellState;
  let override: AdminCalendarOverrideInput | undefined;
  if (booking) state = 'booked';
  else if (blockedBy) [state, override] = ['blocked', blockedBy];
  else if (busyHit && input.calendarBlocking) state = 'busy';
  else if (exact?.kind === 'OPEN') [state, override] = ['extra', exact];
  else state = cell.fromRule ? 'free' : 'off';

  return {
    startsAt: cell.startsAt.toISOString(),
    durationMin: cell.durationMin,
    state,
    busy: busyHit,
    past: cell.startsAt.getTime() <= earliest,
    ...(override ? { overrideStartsAt: override.startsAt.toISOString() } : {}),
    ...(booking
      ? {
          booking: {
            id: booking.id,
            clientName: booking.clientName,
            status: booking.status,
          },
        }
      : {}),
  };
}

function toInterval(x: { startsAt: Date; durationMin: number }): Interval {
  return {
    start: x.startsAt,
    end: new Date(x.startsAt.getTime() + x.durationMin * 60_000),
  };
}

/** [startsAt, +24ч) полуночи dateStr в зоне tz — та же зона, что у фоновой оси. */
function inDay(instant: Date, dateStr: string, tz: string): boolean {
  const start = localMidnightUTC(dateStr, tz).getTime();
  const end = localMidnightUTC(addDaysToDateString(dateStr, 1), tz).getTime();
  const t = instant.getTime();
  return t >= start && t < end;
}
