import { NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptRecord, EncryptSchema } from '../utils/crypto';

// Чтение броней: список для админки, одна по id и публичная проекция по
// cancel-токену. Вынесено из booking.service.ts (правило №10) — сервис
// оставляет себе тонкие делегаты, чтобы контроллеры не переписывались.

/**
 * List bookings for the admin panel.
 *   upcoming  — future HELD + CONFIRMED (default)
 *   past      — anything already started
 *   cancelled — cancelled/expired
 *   all       — everything, most recent first
 */
export async function listBookings(
  prisma: PrismaService,
  schema: EncryptSchema,
  filter: 'upcoming' | 'past' | 'cancelled' | 'all' = 'upcoming',
) {
  const now = new Date();
  const where =
    filter === 'past'
      ? { startsAt: { lt: now } }
      : filter === 'cancelled'
        ? { status: BookingStatus.CANCELLED }
        : filter === 'all'
          ? {}
          : {
              startsAt: { gte: now },
              status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
            };
  const rows = await prisma.booking.findMany({
    where,
    orderBy: { startsAt: filter === 'upcoming' ? 'asc' : 'desc' },
    take: 200,
  });
  return rows.map((r) => decryptRecord(r, schema));
}

export async function getBookingById(
  prisma: PrismaService,
  schema: EncryptSchema,
  id: number,
) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new NotFoundException('Booking not found');
  return decryptRecord(booking, schema);
}

/**
 * Public booking view by self-cancel token (used by the post-payment page).
 * Returns only non-PII session fields — never the client's name/contact.
 */
export async function getPublicBookingByToken(
  prisma: PrismaService,
  token: string,
) {
  const b = await prisma.booking.findUnique({
    where: { cancelToken: token },
  });
  if (!b) throw new NotFoundException('Booking not found');
  return {
    status: b.status,
    type: b.type,
    startsAt: b.startsAt.toISOString(),
    endsAt: new Date(
      b.startsAt.getTime() + b.durationMin * 60_000,
    ).toISOString(),
    durationMin: b.durationMin,
    meetingUrl: b.meetingUrl,
  };
}
