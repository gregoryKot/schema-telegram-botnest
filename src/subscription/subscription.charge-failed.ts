import type { Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Неудачное рекуррентное списание: пометка charge failed и сдвиг подписки
 * одной транзакцией. Подписка трогается ТОЛЬКО если пометка charge прошла
 * (count === 1): если оплату успел подтвердить вебхук (charge уже paid),
 * `nextChargeAt` подписки уже выставил он на период вперёд. Ретрай «через
 * сутки» поверх него дал бы второе реальное списание за оплаченный период.
 * Предикат статуса у подписки — отмена между захватом и ответом Robokassa
 * не откатывается.
 *
 * true — сбой засчитан; false — оплата пришла раньше, ничего не изменено.
 */
export async function markChargeFailed(
  prisma: PrismaService,
  args: {
    chargeId: number;
    subId: number;
    status: Subscription['status'];
    fails: number;
    maxFails: number;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const marked = await tx.subscriptionCharge.updateMany({
      where: { id: args.chargeId, status: { not: 'paid' } },
      data: { status: 'failed' },
    });
    if (marked.count === 0) return false;
    const gaveUp = args.fails >= args.maxFails;
    await tx.subscription.updateMany({
      where: { id: args.subId, status: { in: ['active', 'past_due'] } },
      data: {
        failedAttempts: args.fails,
        status: gaveUp ? 'past_due' : args.status,
        // Retry in a day unless we've given up.
        nextChargeAt: gaveUp ? null : new Date(Date.now() + 24 * 3_600_000),
      },
    });
    return true;
  });
}
