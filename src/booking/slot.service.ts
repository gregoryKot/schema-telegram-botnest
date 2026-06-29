import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalDavService } from './caldav.service';
import { BookingStatus } from '@prisma/client';

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
}

/** Compute free slots for a date range from AvailabilityRules minus existing bookings. */
@Injectable()
export class SlotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calDav: CalDavService,
  ) {}

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

    // Busy intervals from the therapist's real calendar (fail-open → []).
    const calBusy = await this.calDav.getBusyTimes(fromDate, toDate);

    const slots: Slot[] = [];
    const cursor = new Date(fromDate);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setUTCHours(23, 59, 59, 999);

    while (cursor <= end) {
      const jsDay = cursor.getUTCDay();
      for (const rule of rules) {
        if (rule.dayOfWeek !== jsDay) continue;
        const tz = rule.timezone;
        const dateStr = toDateStr(cursor, tz);
        const slotStart = localToUtc(`${dateStr}T${pad(rule.startHour)}:${pad(rule.startMinute)}:00`, tz);
        const slotEnd = localToUtc(`${dateStr}T${pad(rule.endHour)}:${pad(rule.endMinute)}:00`, tz);
        const step = (rule.sessionDuration + rule.bufferMin) * 60_000;

        for (let t = slotStart.getTime(); t + rule.sessionDuration * 60_000 <= slotEnd.getTime(); t += step) {
          const start = new Date(t);
          const finish = new Date(t + rule.sessionDuration * 60_000);
          if (isOccupied(start, finish, busyBookings)) continue;
          if (overlapsBusy(start, finish, calBusy)) continue; // therapist's calendar
          if (start <= new Date()) continue; // no past slots
          slots.push({ startsAt: start, endsAt: finish, durationMin: rule.sessionDuration });
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return slots;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function overlapsBusy(start: Date, end: Date, busy: { start: Date; end: Date }[]): boolean {
  for (const b of busy) {
    if (start.getTime() < b.end.getTime() && end.getTime() > b.start.getTime()) return true;
  }
  return false;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format date as YYYY-MM-DD in given timezone */
function toDateStr(utc: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(utc);
}

/** Convert a local wall-clock datetime string (no Z) to UTC Date using given tz */
function localToUtc(localIso: string, tz: string): Date {
  // Build a reference date at noon UTC on that calendar day, then compute offset
  const [datePart, timePart] = localIso.split('T');
  const [h, m] = timePart.split(':').map(Number);
  const noonUtc = new Date(`${datePart}T12:00:00.000Z`);
  const localNoon = new Date(noonUtc.toLocaleString('en-US', { timeZone: tz }));
  const offset = Math.round((noonUtc.getTime() - localNoon.getTime()) / 60_000); // utc-local in minutes
  const naive = new Date(`${datePart}T${timePart}.000Z`);
  return new Date(naive.getTime() + offset * 60_000);
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
