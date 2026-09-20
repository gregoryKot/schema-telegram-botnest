import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ruleCoversSlot } from './availability-window';
import { overlapsInterval, overrideInterval } from './slot-filters';

// Проверки доступности слота: окно AvailabilityRule + ручной слой
// SlotOverride, и пересечения с бронями (правило №10, вынесено из booking.service.ts).
// MAX_OVERRIDE_MIN=180: override живёт максимум 180 мин — запас скана назад
// для BLOCK, начавшегося раньше startsAt, но пересекающего его.
const MAX_OVERRIDE_MIN = 180;

// Слот обязан попадать в окно правила (его TZ) либо быть разрешён OPEN;
// BLOCK отклоняет бронь ДАЖЕ если правило её разрешает. Правил нет вообще
// (dev) — пропускаем как раньше.
export async function assertWithinAvailability(
  prisma: PrismaService,
  startsAt: Date,
  durationMin: number,
) {
  if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 180) {
    throw new BadRequestException('Invalid duration');
  }
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const scanFrom = new Date(startsAt.getTime() - MAX_OVERRIDE_MIN * 60_000);
  const overrides = await prisma.slotOverride.findMany({
    where: { startsAt: { gte: scanFrom, lt: endsAt } },
  });
  const blocked = overrides.some(
    (o) =>
      o.kind === 'BLOCK' &&
      overlapsInterval(startsAt, endsAt, [overrideInterval(o)]),
  );
  if (blocked) throw new BadRequestException('SLOT_BLOCKED');

  const rules = await prisma.availabilityRule.findMany({
    where: { isActive: true },
  });
  if (rules.length === 0) return;
  if (rules.some((r) => ruleCoversSlot(r, startsAt, durationMin))) return;

  const open = overrides.find(
    (o) => o.kind === 'OPEN' && o.startsAt.getTime() === startsAt.getTime(),
  );
  if (open && durationMin <= open.durationMin) return;
  throw new BadRequestException('OUTSIDE_AVAILABILITY');
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
