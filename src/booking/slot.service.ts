import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CalDavService } from './caldav.service';
import { BookingStatus } from '@prisma/client';
import { MIN_BOOK_LEAD_HOURS } from './booking.config';
import { localDate, localMidnightUTC } from '../utils/tz';

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
}

/** Compute free slots for a date range from AvailabilityRules minus existing bookings. */
@Injectable()
export class SlotService {
  // Excluding the therapist's calendar busy-times is OPT-IN: a misbehaving or
  // slow calendar must never be able to zero out the whole booking funnel.
  // Turn on with CALENDAR_BLOCK_SLOTS=true once the admin panel shows a sane
  // "занято: N" count.
  private readonly blockBusy: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly calDav: CalDavService,
    config: ConfigService,
  ) {
    this.blockBusy = config.get<string>('CALENDAR_BLOCK_SLOTS') === 'true';
  }

  /**
   * Return available slots between fromDate and toDate (inclusive).
   * Uses therapist's active AvailabilityRules. Excludes HELD/CONFIRMED bookings
   * AND busy times from the therapist's Apple Calendar (if CalDAV configured).
   */
  async getSlots(fromDate: Date, toDate: Date): Promise<Slot[]> {
    const rules = await this.prisma.availabilityRule.findMany({
      where: { isActive: true },
    });
    if (!rules.length) return [];

    // Fetch all bookings in window that occupy a slot
    const busyBookings = await this.prisma.booking.findMany({
      where: {
        startsAt: { gte: fromDate, lte: toDate },
        status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
      },
      select: { startsAt: true, durationMin: true },
    });

    // Busy intervals from the therapist's real calendar — only when explicitly
    // enabled, so /slots never depends on (or hangs on) CalDAV by default.
    const calBusy = this.blockBusy
      ? await this.calDav.getBusyTimes(fromDate, toDate)
      : [];

    // Earliest bookable instant: now + minimum lead time.
    const earliest = Date.now() + MIN_BOOK_LEAD_HOURS * 3_600_000;

    // Окно, в которое обязан попасть каждый возвращённый слот — целые UTC-сутки
    // fromDate..toDate (так исторически трактует диапазон вызывающий код,
    // /api/booking/slots?from=YYYY-MM-DD&to=YYYY-MM-DD без времени).
    const rangeStart = new Date(fromDate);
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = new Date(toDate);
    rangeEnd.setUTCHours(23, 59, 59, 999);

    // ПОДВОХ UTC-vs-местное время (был баг, см. slot.service.spec.ts): курсор
    // ниже бежит по суткам В UTC, но день недели и календарная дата правила
    // обязаны браться из ОДНОЙ И ТОЙ ЖЕ локальной даты в его же timezone —
    // раньше jsDay брался из cursor.getUTCDay() (UTC-день), а календарная
    // дата (dateStr) — уже из локального времени того же курсора; для
    // таймзоны западнее UTC (America/New_York) в полночь UTC локально ещё
    // предыдущие сутки, и день недели с датой расходились. Правильно:
    // определить местную календарную дату курсора (localDate) и посчитать
    // день недели ОТ НЕЁ, а не от cursor.getUTCDay(). Курсор бежит с запасом
    // ±1 UTC-сутки — иначе крайний локальный день западной таймзоны выпадал
    // бы из перебора; лишние (по запасу) кандидаты просто не проходят
    // проверку rangeStart/rangeEnd ниже. Для Europe/Moscow (восточнее UTC,
    // единственная прод-таймзона) местная дата совпадает с UTC-датой курсора,
    // так что расширение диапазона и порядок вычислений не меняют результат.
    const cursor = new Date(rangeStart);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const cursorEnd = new Date(rangeEnd);
    cursorEnd.setUTCDate(cursorEnd.getUTCDate() + 1);

    const slots: Slot[] = [];
    while (cursor <= cursorEnd) {
      for (const rule of rules) {
        const tz = rule.timezone;
        const dateStr = localDate(tz, cursor);
        const localDow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
        if (rule.dayOfWeek !== localDow) continue;

        const dayStartMs = localMidnightUTC(dateStr, tz).getTime();
        const slotStartMs =
          dayStartMs + (rule.startHour * 60 + rule.startMinute) * 60_000;
        const slotEndMs =
          dayStartMs + (rule.endHour * 60 + rule.endMinute) * 60_000;
        const step = (rule.sessionDuration + rule.bufferMin) * 60_000;

        for (
          let t = slotStartMs;
          t + rule.sessionDuration * 60_000 <= slotEndMs;
          t += step
        ) {
          const start = new Date(t);
          const finish = new Date(t + rule.sessionDuration * 60_000);
          if (start < rangeStart || start > rangeEnd) continue; // вне запрошенного окна (запас курсора)
          if (isOccupied(start, finish, busyBookings)) continue;
          if (overlapsBusy(start, finish, calBusy)) continue; // therapist's calendar
          if (start.getTime() <= earliest) continue; // past + min lead time (no last-minute)
          slots.push({
            startsAt: start,
            endsAt: finish,
            durationMin: rule.sessionDuration,
          });
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return slots;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function overlapsBusy(
  start: Date,
  end: Date,
  busy: { start: Date; end: Date }[],
): boolean {
  for (const b of busy) {
    if (start.getTime() < b.end.getTime() && end.getTime() > b.start.getTime())
      return true;
  }
  return false;
}

function isOccupied(
  start: Date,
  end: Date,
  bookings: { startsAt: Date; durationMin: number }[],
): boolean {
  for (const b of bookings) {
    const bs = b.startsAt.getTime();
    const be = bs + b.durationMin * 60_000;
    if (start.getTime() < be && end.getTime() > bs) return true;
  }
  return false;
}
