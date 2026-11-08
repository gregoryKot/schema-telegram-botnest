// Сессия ЭТОГО браузера по refresh-куке: чья она и какой семье принадлежит.
// Нужна включению 2FA (S12, аудит 2026-11): отозвать все сессии аккаунта,
// кроме той, из которой 2FA включают, — иначе тот, кто увёл сессию раньше,
// остаётся внутри и после защиты.
import type { PrismaService } from '../prisma/prisma.service';
import { hashToken } from './email.util';

/** Семья живой сессии по сырому refresh-токену; null — кука чужая или мёртвая. */
export async function currentFamily(
  prisma: PrismaService,
  rawRefresh: string | undefined,
  userId: bigint,
): Promise<string | null> {
  if (!rawRefresh) return null;
  const s = await prisma.webSession.findUnique({
    where: { tokenHash: hashToken(rawRefresh) },
    select: { userId: true, family: true, revokedAt: true, expiresAt: true },
  });
  if (!s || s.revokedAt || s.expiresAt < new Date() || s.userId !== userId)
    return null;
  return s.family;
}

/**
 * Отозвать все живые сессии аккаунта, кроме семьи текущей куки. Куки нет или
 * она чужая — отзываются все: оставлять «на всякий случай» нечего.
 * Access-токены отозванных сессий доживают свои ≤15 минут (они без состояния).
 */
export async function revokeOtherSessions(
  prisma: PrismaService,
  userId: bigint,
  rawRefresh: string | undefined,
): Promise<number> {
  const keep = await currentFamily(prisma, rawRefresh, userId);
  const res = await prisma.webSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keep ? { NOT: { family: keep } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return res.count;
}
