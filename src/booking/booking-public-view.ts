import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../utils/crypto';

/**
 * Public booking view by self-cancel token (used by the post-payment page).
 * Returns only non-PII session fields — never the client's name/contact.
 *
 * `paid` — булев «деньги получены вебхуком» (из `paidAt`, самой метки не
 * отдаём). `paidAt` и переход в CONFIRMED пишутся одним `updateMany`, поэтому
 * у HELD-брони `paid` всегда false: страница возврата не может увидеть «оплачено,
 * но не подтверждено» — она различает другое, CANCELLED + paid («деньги есть,
 * брони нет») и CANCELLED без оплаты.
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
    paid: b.paidAt != null,
    type: b.type,
    startsAt: b.startsAt.toISOString(),
    endsAt: new Date(
      b.startsAt.getTime() + b.durationMin * 60_000,
    ).toISOString(),
    durationMin: b.durationMin,
    meetingUrl: decrypt(b.meetingUrl),
  };
}
