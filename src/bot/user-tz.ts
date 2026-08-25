import { PrismaService } from '../prisma/prisma.service';

// Таймзона пользователя для локальных дат метрик (вынесено из
// bot.analytics.service.ts при распиле, правило №10).
export async function userTimezone(
  prisma: PrismaService,
  userId: bigint,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyTimezone: true },
  });
  return user?.notifyTimezone ?? 'Europe/Moscow';
}
