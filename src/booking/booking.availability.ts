import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Проверки доступности слота: попадание в окно AvailabilityRule и
// отсутствие пересечений с существующими бронями. Вынесено из
// booking.service.ts (правило №10) — чистые функции над prisma/tx.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Время и длительность запрошенной сессии обязаны попадать в активное окно
 * AvailabilityRule (в таймзоне правила). Если правил нет вообще
 * (dev/расписание не настроено) — пропускаем, сохраняя прежнее поведение:
 * легитимный клиент в этом случае и так не видит слотов.
 */
export async function assertWithinAvailability(
  prisma: PrismaService,
  startsAt: Date,
  durationMin: number,
) {
  if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 180) {
    throw new BadRequestException('Invalid duration');
  }
  const rules = await prisma.availabilityRule.findMany({
    where: { isActive: true },
  });
  if (rules.length === 0) return;

  const ok = rules.some((r) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: r.timezone,
      hour12: false,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(startsAt);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const day = WEEKDAYS.indexOf(get('weekday'));
    if (day !== r.dayOfWeek) return false;
    const startMin = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
    const winStart = r.startHour * 60 + r.startMinute;
    const winEnd = r.endHour * 60 + r.endMinute;
    return startMin >= winStart && startMin + durationMin <= winEnd;
  });
  if (!ok) throw new BadRequestException('OUTSIDE_AVAILABILITY');
}

// Overlap test: an existing HELD/CONFIRMED booking collides when
// existing.startsAt < newEnd AND existing.end > newStart. Prisma can't add
// durationMin to startsAt in a filter, so we narrow by startsAt then check
// the computed end in JS.
export async function assertSlotFree(
  tx: Prisma.TransactionClient | PrismaService,
  startsAt: Date,
  durationMin: number,
) {
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  // D4 (аудит 2026-08): нижняя граница скана — 24ч (запас над любой сессией).
  // Без неё брались ВСЕ CONFIRMED от начала времён (COMPLETED не пишется —
  // копятся навсегда), стоимость проверки слота росла с возрастом продукта.
  const scanFrom = new Date(startsAt.getTime() - 24 * 60 * 60_000);
  const candidates = await tx.booking.findMany({
    where: {
      status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
      startsAt: { gte: scanFrom, lt: endsAt },
    },
  });
  for (const c of candidates) {
    const cEnd = new Date(c.startsAt.getTime() + c.durationMin * 60_000);
    if (cEnd > startsAt) throw new ConflictException('Slot already taken');
  }
}
