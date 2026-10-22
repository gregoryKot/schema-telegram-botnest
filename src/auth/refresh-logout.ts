// Выход (logout) закрывает всю family предъявленного токена. Вынесено из
// refresh-theft.ts / auth.service.ts: оба файла стоят в храповике размера
// (правило №10 CLAUDE.md) и расти не могут.
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Тихий отзыв всей family — для «Выйти»: человек сам закрывает цепочку, это не
 * событие безопасности. Без алерта и эха. Раньше logout гасил только
 * предъявленный токен, и вор с соседом/наследником в той же семье переживал
 * выход жертвы (аудит 2026-10).
 */
export async function revokeFamilyQuiet(
  prisma: PrismaService,
  family: string,
): Promise<void> {
  await prisma.webSession.updateMany({
    where: { family, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
