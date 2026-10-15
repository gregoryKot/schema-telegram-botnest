import { PrismaService } from '../prisma/prisma.service';

/**
 * Оплаченный charge → активация подписки одной транзакцией (вебхук Robokassa).
 *
 * P-2 (аудит 2026-07): CAS по статусу charge — параллельные ретраи webhook не
 * задваивают активацию и алерты. Charge и подписка пишутся вместе: упавшая
 * запись подписки откатывает charge, и ретрай Robokassa довершает работу.
 * Предикат `status in` не даёт оплате воскресить отменённую подписку
 * (аудит 2026-10, security#17): деньги засчитаны за charge, подписка не тронута.
 *
 * 'skip' — charge уже оплачен другим вызовом; 'live' — подписка активирована;
 * 'cancelled' — деньги пришли, а подписка отменена (нужен сигнал владельцу).
 */
export async function activatePaidCharge(
  prisma: PrismaService,
  args: {
    chargeId: number;
    subId: number;
    isFirst: boolean;
    invId: number;
    next: Date;
  },
): Promise<'skip' | 'live' | 'cancelled'> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.subscriptionCharge.updateMany({
      where: { id: args.chargeId, status: { not: 'paid' } },
      data: { status: 'paid', paidAt: new Date() },
    });
    if (claimed.count === 0) return 'skip';
    const moved = await tx.subscription.updateMany({
      where: {
        id: args.subId,
        status: { in: ['pending', 'active', 'past_due'] },
      },
      data: {
        status: 'active',
        lastChargeAt: new Date(),
        nextChargeAt: args.next,
        failedAttempts: 0,
        // Первый оплаченный charge — PreviousInvoiceID всех будущих списаний.
        ...(args.isFirst ? { firstInvId: args.invId } : {}),
      },
    });
    return moved.count > 0 ? 'live' : 'cancelled';
  });
}
