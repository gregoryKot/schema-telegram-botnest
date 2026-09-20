import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CalDavService } from './caldav.service';
import { BookingStatus } from '@prisma/client';
import { MIN_BOOK_LEAD_HOURS } from './booking.config';
import { localDate } from '../utils/tz';
import { expandRuleForDay, weekdayOf } from './rule-expand';
import { isOccupied, overlapsBusy, applyOverrides } from './slot-filters';

// D1 (аудит 2026-08): жёсткий потолок перебора по суткам в getSlots — год с
// запасом. Контроллер режет пользовательский запрос строже (92 дня); это —
// абсолютный предохранитель от зависания event-loop при вызове в обход него.
const MAX_SLOT_SCAN_DAYS = 366;

// Override живёт максимум 180 мин (SlotOverrideItemDto) — запас скана назад
// от rangeStart, чтобы поймать BLOCK, начавшийся раньше окна, но
// пересекающий его.
const MAX_OVERRIDE_MIN = 180;

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
   * Uses therapist's active AvailabilityRules PLUS ручной слой SlotOverride
   * (BLOCK убирает, OPEN добавляет вне правил). Excludes HELD/CONFIRMED
   * bookings AND busy times from the therapist's Apple Calendar (if configured).
   */
  async getSlots(fromDate: Date, toDate: Date): Promise<Slot[]> {
    const rules = await this.prisma.availabilityRule.findMany({
      where: { isActive: true },
    });

    // Окно, в которое обязан попасть каждый возвращённый слот — целые UTC-сутки
    // fromDate..toDate (так исторически трактует диапазон вызывающий код,
    // /api/booking/slots?from=YYYY-MM-DD&to=YYYY-MM-DD без времени).
    const rangeStart = new Date(fromDate);
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rawRangeEnd = new Date(toDate);
    rawRangeEnd.setUTCHours(23, 59, 59, 999);
    // D1 (аудит 2026-08): защитный потолок перебора по суткам. Контроллер уже
    // режет запрос на 92 дня (400) — это второй рубеж на случай вызова в обход
    // него: без него огромный диапазон вешал event-loop (DoS всего API).
    const maxEndMs = rangeStart.getTime() + MAX_SLOT_SCAN_DAYS * 86_400_000;
    const rangeEnd =
      rawRangeEnd.getTime() > maxEndMs ? new Date(maxEndMs) : rawRangeEnd;

    // Ручной слой нужен ДО раннего выхода: OPEN обязан работать и без единого
    // правила (см. slot.service.spec.ts). Запас назад — максимальная
    // длительность override'а, BLOCK мог начаться раньше rangeStart.
    const overrides = await this.prisma.slotOverride.findMany({
      where: {
        startsAt: {
          gte: new Date(rangeStart.getTime() - MAX_OVERRIDE_MIN * 60_000),
          lte: rangeEnd,
        },
      },
    });
    const hasOpen = overrides.some((o) => o.kind === 'OPEN');
    if (!rules.length && !hasOpen) return [];

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
        const dateStr = localDate(rule.timezone, cursor);
        if (rule.dayOfWeek !== weekdayOf(dateStr)) continue;

        for (const { startsAt: start, endsAt: finish } of expandRuleForDay(
          rule,
          dateStr,
        )) {
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

    // Запас −180 мин выше нужен только BLOCK; OPEN вне запрошенного окна —
    // не слот этого окна (иначе /slots?from=… отдавал бы прошлые сутки).
    const inWindow = overrides.filter(
      (o) =>
        o.kind !== 'OPEN' ||
        (o.startsAt >= rangeStart && o.startsAt <= rangeEnd),
    );
    return applyOverrides(slots, inWindow, {
      earliest,
      bookings: busyBookings,
      busy: calBusy,
    });
  }
}
