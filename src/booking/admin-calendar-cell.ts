// Разрешение одной ячейки календаря админки: пересечения с бронями, ручным
// слоем, занятостью календаря → state по приоритету + «чем занято». Вынесено
// из admin-calendar.ts (правило №10: тот упёрся в потолок 300 строк, здесь —
// сборка сетки, там — окно/ось/перебор дней). Чистые функции, без БД.
import { overlapsInterval, overrideInterval } from './slot-filters';
import { Interval } from './caldav-busy';
import type {
  AdminCalendarCell,
  AdminCalendarCellState,
  AdminCalendarOverrideInput,
  BuildAdminCalendarInput,
  WorkingCell,
} from './admin-calendar';

/** Пункт 6 контракта: busy/booking/override → state по приоритету
 *  booked > blocked > busy(если calendarBlocking) > extra > free > off. */
export function resolveCell(
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
  const busyHits = input.busy.filter((iv) =>
    overlapsInterval(cell.startsAt, end, [iv]),
  );
  const busyHit = busyHits.length > 0;
  const busyTitle = summarizeBusy(busyHits);

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
    ...(busyTitle ? { busyTitle } : {}),
  };
}

// «Чем занято» в чипе — суммарно не длиннее этого (правило владельца).
const BUSY_TITLE_MAX_LEN = 160;

/** Названия событий, пересёкших ячейку: дедуп одинаковых, объединены через
 *  « · », обрезаны по BUSY_TITLE_MAX_LEN. undefined — ни у одного нет SUMMARY. */
function summarizeBusy(hits: Interval[]): string | undefined {
  const names = new Set<string>();
  for (const hit of hits) if (hit.summary) names.add(hit.summary);
  if (!names.size) return undefined;
  const joined = [...names].join(' · ');
  return joined.length > BUSY_TITLE_MAX_LEN
    ? `${joined.slice(0, BUSY_TITLE_MAX_LEN)}…`
    : joined;
}

export function toInterval(x: {
  startsAt: Date;
  durationMin: number;
}): Interval {
  return {
    start: x.startsAt,
    end: new Date(x.startsAt.getTime() + x.durationMin * 60_000),
  };
}
