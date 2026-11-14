// Чем входят на сайт — и кому сессию вне мессенджера не выдаём.
//
// Запрос Роскомнадзора №08-1063539 (п. 4 ч. 10 ст. 8 149-ФЗ): пользователей из
// России нельзя авторизовать на сайте через иностранный сервис. Telegram —
// иностранный, поэтому с 2026-11 он остаётся входом только ВНУТРИ Telegram
// (подпись initData), а всё, что переносит личность оттуда в браузер, закрыто:
//   - билет входа (`intent: 'login'`) с подтверждением в боте — удалён;
//   - одобрить билет входа из своей сессии (`confirm-login`) может только
//     аккаунт со входом VK ID, Яндекс ID или MAX;
//   - передача сессии во внешний браузер (`handoff`) — только из MAX.
// Вход по ссылке на почту тоже убран (решение владельца, ч. 10 ст. 8 149-ФЗ):
// почта остаётся для писем, а не для входа. MAX — российский сервис, но OAuth
// для сайтов у него нет: вход через MAX — билет, который человек подтверждает
// в мини-приложении (`/auth/confirm`). Привязка (`intent: 'link'`) остаётся:
// её начинает человек, уже вошедший на сайт VK ID, Яндекс ID или через MAX.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

/** Способы, которыми подтверждают билет входа: в браузере или в мини-приложении MAX. */
export const SITE_TICKET_PROVIDERS = ['vk', 'yandex', 'max'] as const;

/** Чьей сессии можно одобрить вход в браузер: VK ID, Яндекс ID, MAX. */
const SITE_ACCOUNT_PROVIDERS = ['vk', 'yandex', 'max'];

/** Билет входа выписывают только под способ, которым входят на сайт. */
export function assertSiteTicket(intent: string, provider: string): void {
  if (intent !== 'login') return;
  if (!(SITE_TICKET_PROVIDERS as readonly string[]).includes(provider)) {
    throw new BadRequestException('Этим способом на сайт не входят');
  }
}

async function hasProvider(
  prisma: PrismaService,
  userId: bigint,
  provider: string | { in: string[] },
): Promise<boolean> {
  const n = await prisma.authProvider.count({ where: { userId, provider } });
  return n > 0;
}

/** Одобрить вход в браузер может только аккаунт со входом VK ID, Яндекс ID, MAX. */
export async function assertSiteAccount(
  prisma: PrismaService,
  userId: bigint,
): Promise<void> {
  const provider = { in: SITE_ACCOUNT_PROVIDERS };
  if (!(await hasProvider(prisma, userId, provider))) {
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
