// Передача сессии из MAX во внешний браузер (intent: 'handoff').
import { createHash, randomBytes } from 'crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import { newUserCode, staleTicketsWhere } from './ticket-user-code';
import { assertHandoffFromMax } from './site-login';

/** Короче обычных 300 с: код едет в URL (`/install#h=…`). */
export const HANDOFF_TTL_S = 120;

export interface HandoffInput {
  userId: bigint;
  /** Откуда просят: только 'max' (site-login.ts). */
  hostId: string;
  deviceLabel: string;
}

// Билет, подтверждённый хозяином сразу при выписке: браузер заберёт ту же
// сессию обычным `poll`. Короткий код нужен схеме, но наружу не выходит.
export async function issueHandoff(
  prisma: PrismaService,
  input: HandoffInput,
): Promise<{ deviceCode: string; expiresIn: number }> {
  await assertHandoffFromMax(prisma, input);
  const hash = (v: string) => createHash('sha256').update(v).digest('hex');
  // Гасим только прежние handoff ЭТОГО аккаунта и протухшие: общий
  // staleTicketsWhere(userId) снёс бы и его живую привязку (intent 'link'),
  // которую человек в этот момент подтверждает в браузере, — карточка
  // «Установить приложение» на «Сегодня» запрашивает код сама, без тапа.
  await prisma.loginTicket.deleteMany({
    where: {
      OR: [
        { userId: input.userId, intent: 'handoff' },
        staleTicketsWhere(null),
      ],
    },
  });
  const deviceCode = randomBytes(32).toString('hex');
  const now = new Date();
  await prisma.loginTicket.create({
    data: {
      deviceCodeHash: hash(deviceCode),
      userCodeHash: hash(newUserCode()),
      userId: input.userId,
      approvedUserId: input.userId,
      approvedAt: now,
      intent: 'handoff',
      provider: input.hostId,
      hostId: 'web',
      deviceLabel: input.deviceLabel,
      expiresAt: new Date(now.getTime() + HANDOFF_TTL_S * 1000),
    },
  });
  return { deviceCode, expiresIn: HANDOFF_TTL_S };
}
