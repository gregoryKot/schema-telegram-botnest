// Чем входят на сайт — и кому сессию вне мессенджера не выдаём.
//
// Запрос Роскомнадзора №08-1063539 (п. 4 ч. 10 ст. 8 149-ФЗ): пользователей из
// России нельзя авторизовать на сайте через иностранный сервис. Telegram —
// иностранный, поэтому с 2026-11 он остаётся входом только ВНУТРИ Telegram
// (подпись initData), а всё, что переносит личность оттуда в браузер, закрыто:
//   - билет входа (`intent: 'login'`) с подтверждением в боте — удалён;
//   - одобрить билет входа из своей сессии (`confirm-login`) может только
//     аккаунт, у которого есть способ входа кроме Telegram;
//   - передача сессии во внешний браузер (`handoff`) — только из MAX.
// Привязка (`intent: 'link'`) остаётся: её начинает человек, уже вошедший на
// сайт почтой или VK ID.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

/** Способы, которыми билет входа подтверждают в браузере. */
export const SITE_TICKET_PROVIDERS = ['vk', 'email'] as const;

/** Билет входа выписывают только под подтверждение в браузере. */
export function assertSiteTicket(intent: string, provider: string): void {
  if (intent !== 'login') return;
  if (!(SITE_TICKET_PROVIDERS as readonly string[]).includes(provider)) {
    throw new BadRequestException('Этим способом на сайт не входят');
  }
}

async function hasProvider(
  prisma: PrismaService,
  userId: bigint,
  provider: string | { not: string },
): Promise<boolean> {
  const n = await prisma.authProvider.count({ where: { userId, provider } });
  return n > 0;
}

/** Одобрить вход в браузер может аккаунт со способом входа кроме Telegram. */
export async function assertSiteAccount(
  prisma: PrismaService,
  userId: bigint,
): Promise<void> {
  if (!(await hasProvider(prisma, userId, { not: 'telegram' }))) {
    throw new BadRequestException('Этот аккаунт открывается в Telegram');
  }
}

/**
 * Передать сессию в браузер можно только из MAX. hostId прислал клиент,
 * поэтому решает не он, а строка AuthProvider: аккаунт без входа из MAX
 * билет не получит, что бы ни было в теле.
 */
export async function assertHandoffFromMax(
  prisma: PrismaService,
  input: { userId: bigint; hostId: string },
): Promise<void> {
  if (
    input.hostId !== 'max' ||
    !(await hasProvider(prisma, input.userId, 'max'))
  ) {
    throw new ForbiddenException('Передача сессии в браузер — только из MAX');
  }
}
