// Кому принадлежит НОВЫЙ для входа по почте адрес (у токена userId = null).
//
// Вход через Google убран 2026-11 (запрос РКН №08-1063539: п. 4 ч. 10 ст. 8
// 149-ФЗ — авторизация через иностранный сервис). Строки
// AuthProvider(provider='google') остались в базе: в них лежит адрес, который
// Google подтвердил при входе (email_verified был обязателен). Человек, у
// которого другого способа входа нет, вводит ту же почту — и обязан попасть в
// СВОЙ аккаунт, а не в новый пустой.
//
// Поиск идёт только здесь, при погашении ссылки — после доказательства
// владения ящиком, а не на анонимном запросе письма. Адрес в строках Google
// зашифрован случайным IV (auth-provider-crypto.ts), равенством в SQL его не
// найти: строки расшифровываются и сравниваются в памяти. Их число конечно и
// больше не растёт (входа через Google нет), а после первого входа у аккаунта
// появляется строка provider='email' — дальше адрес находится по ключу.
import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthService } from './auth.service';
import { decrypt } from '../utils/crypto';

const logger = new Logger('EmailLoginUser');

/** userId прежнего входа через Google с этим адресом; null — нет или неоднозначно. */
export async function findLegacyGoogleUserId(
  prisma: PrismaService,
  lowerEmail: string,
): Promise<bigint | null> {
  const rows = await prisma.authProvider.findMany({
    where: { provider: 'google' },
    select: { userId: true, email: true },
  });
  const owners = new Set<string>();
  for (const row of rows) {
    const email = decrypt(row.email)?.trim().toLowerCase();
    if (email && email === lowerEmail) owners.add(String(row.userId));
  }
  if (owners.size > 1) {
    // Два аккаунта с одним адресом Google: чей он — не угадываем.
    logger.warn(
      `адрес входа по почте совпал с ${owners.size} аккаунтами Google — заведён новый аккаунт`,
    );
    return null;
  }
  const [only] = [...owners];
  return only === undefined ? null : BigInt(only);
}

/**
 * Аккаунт для подтверждённого адреса без строки provider='email': прежний
 * Google-аккаунт с этой почтой (ему дописывается вход по почте) либо новый.
 */
export async function resolveEmailLoginUser(
  prisma: PrismaService,
  auth: AuthService,
  lowerEmail: string,
): Promise<bigint> {
  const legacy = await findLegacyGoogleUserId(prisma, lowerEmail);
  if (legacy !== null) {
    const linked = await auth.linkProviderToUser(
      legacy,
      'email',
      lowerEmail,
      undefined,
      lowerEmail,
    );
    if (linked.ok) return legacy;
  }
  // Имени у входа по почте нет: часть адреса до @ — это почта, а не имя, и
  // открытым в User.firstName ей не место (S16, аудит 2026-11).
  return auth.findOrCreateUserByProvider('email', lowerEmail);
}
