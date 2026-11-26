// Жив ли владелец access-токена — общая сверка JwtAuthGuard и TelegramAuthGuard
// (путь Bearer); оба и так читали User на каждый запрос.
//
// Аккаунт (A5, аудит 2026-10): токен живёт 15 минут — дольше удаления или
// слияния аккаунта; нет строки или стоит deletedAt — 401.
//
// Сессия (хвост S12, аудит 2026-11): токен несёт `sid` — family refresh-цепочки,
// из которой выписан (`AuthService.signAccessToken`). Цепочку отозвали
// («Выйти», кража, отзыв остальных сессий при включении 2FA, удаление) — живой
// строки WebSession в семье нет, и токен перестаёт работать на следующем же
// запросе, а не через ≤15 минут. Ротация гасит старую строку и в той же
// транзакции заводит наследника в той же семье — живая строка есть всегда.
//
// Токен БЕЗ `sid` (выписан до этой правки) принимается до своего истечения:
// это ≤15 минут после выкладки, то же окно, что было у каждого токена до неё.
// Выкинуть всех вошедших в момент деплоя дороже, а подделать токен без sid
// нельзя — подпись JWT_SECRET. Тестовый хелпер e2e (`test/e2e-support/jwt.ts`)
// тоже выписывает токен без sid: им проверяется владение данными, не сессия.
import { UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export async function assertLiveAccess(
  prisma: PrismaService,
  userId: bigint,
  sid?: string,
): Promise<void> {
  // Два запроса параллельно: по задержке — как один (WebSession по @@index([family])).
  const [account, session] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true },
    }),
    sid
      ? prisma.webSession.findFirst({
          where: { family: sid, userId, revokedAt: null },
          select: { id: true },
        })
      : null,
  ]);
  if (!account || account.deletedAt)
    throw new UnauthorizedException('Account gone');
  if (sid && !session) throw new UnauthorizedException('Session revoked');
}
