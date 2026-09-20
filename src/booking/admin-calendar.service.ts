import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalDavService } from './caldav.service';
import { calDavHealth } from './caldav-health';
import { SlotOverrideService } from './slot-override.service';
import { decryptRecord } from '../utils/crypto';
import { SCHEMA } from './booking.service';
import { localMidnightUTC } from '../utils/tz';
import { addDaysToDateString } from './rule-expand';
import { buildAdminCalendar, AdminCalendarDay } from './admin-calendar';

export interface AdminCalendar {
  timezone: string;
  calendarConnected: boolean;
  calendarBlocking: boolean;
  calendarReadError: string | null;
  days: AdminCalendarDay[];
}

/**
 * Собирает данные (правила, ручной слой SlotOverride, брони, занятость
 * календаря) и делегирует сборку сетки чистой buildAdminCalendar — контракт
 * «Календарь слотов в админке».
 */
@Injectable()
export class AdminCalendarService {
  private readonly calendarBlocking: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly overrides: SlotOverrideService,
    private readonly calDav: CalDavService,
    config: ConfigService,
  ) {
    this.calendarBlocking =
      config.get<string>('CALENDAR_BLOCK_SLOTS') === 'true';
  }

  async getCalendar(fromStr: string, toStr: string): Promise<AdminCalendar> {
    const rules = await this.prisma.availabilityRule.findMany({
      where: { isActive: true },
    });
    // Зона правил — якорь всего календаря (фон, границы дня), не у каждого
    // правила своя: см. AdminCalendarDay в admin-calendar.ts.
    const timezone = rules[0]?.timezone ?? 'Europe/Moscow';

    const from = localMidnightUTC(fromStr, timezone);
    const to = localMidnightUTC(addDaysToDateString(toStr, 1), timezone);

    // Занятость запрашиваем ВСЕГДА при enabled — независимо от
    // CALENDAR_BLOCK_SLOTS: админ хочет видеть личные встречи в любом случае,
    // блокировку слотов ими решает отдельный тумблер.
    const [overrideRows, bookingRows, busy] = await Promise.all([
      this.overrides.listBetween(from, to),
      this.prisma.booking.findMany({
        where: {
          startsAt: { gte: from, lt: to },
          status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
        },
      }),
      this.calDav.enabled
        ? this.calDav.getBusyTimes(from, to)
        : Promise.resolve([]),
    ]);
    // Снимок ПОСЛЕ getBusyTimes — тот же приём, что buildCalendarStatus
    // (booking-admin.calendar.ts): именно getBusyTimes обновляет calDavHealth.
    const snap = calDavHealth.snapshot();

    const bookings = bookingRows.map((b) => {
      const decrypted = decryptRecord(b, SCHEMA);
      return {
        id: b.id,
        startsAt: b.startsAt,
        durationMin: b.durationMin,
        clientName: decrypted.clientName,
        status: b.status as 'HELD' | 'CONFIRMED',
      };
    });

    const days = buildAdminCalendar({
      from: fromStr,
      to: toStr,
      timezone,
      rules,
      overrides: overrideRows,
      bookings,
      busy,
      calendarBlocking: this.calendarBlocking,
      now: new Date(),
    });

    return {
      timezone,
      calendarConnected: this.calDav.enabled,
      calendarBlocking: this.calendarBlocking,
      calendarReadError: snap.open ? snap.lastFailDetail : null,
      days,
    };
  }
}
