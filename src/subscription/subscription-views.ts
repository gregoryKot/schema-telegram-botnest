import { PrismaService } from '../prisma/prisma.service';

// Чтение подписки без побочных эффектов. Вынесено из subscription.service.ts
// (правило №10): сервис оставляет тонкий делегат.

/** Active subscription for a Telegram user (for bot management). */
export async function findActiveByTelegram(
  prisma: PrismaService,
  telegramId: bigint,
) {
  const sub = await prisma.subscription.findFirst({
    where: { telegramId, status: { in: ['active', 'past_due'] } },
    orderBy: { createdAt: 'desc' },
  });
  return sub
    ? {
        id: sub.id,
        status: sub.status,
        period: sub.period,
        amount: sub.amount,
        nextChargeAt: sub.nextChargeAt,
        cancelToken: sub.cancelToken,
      }
    : null;
}
