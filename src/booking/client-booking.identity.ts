// Кто записывается из приложения (#546): имя и контакт без формы — их знает
// аккаунт. Имя — так, как клиента видит терапевт: алиас в связи (clientAlias,
// шифрован), иначе имя аккаунта. Контакт — Telegram-ссылка по id (ника в БД
// нет: initData его не хранит), иначе e-mail аккаунта; нет ни того ни другого —
// номер аккаунта, по которому владелец найдёт клиента в кабинете.
// Telegram-адрес — по AuthProvider, а для старого пользователя бота без
// привязки — сам userId (тот же порядок, что resolveChatId в bot/send-settings.ts).
import type { PrismaService } from '../prisma/prisma.service';
import { decryptName } from '../therapy/client-name';
import { decryptAuthProviderRow } from '../utils/auth-provider-crypto';
import { isTelegramUserId } from '../auth/user-id-range';
import type { ContactChannel } from './contact-channel';

export interface ClientIdentity {
  name: string;
  contact: string;
  channel?: ContactChannel;
  telegramId: bigint | null;
}

/** Тот же предел, что у `BookDto.clientName` (публичная форма). */
const NAME_MAX = 100;
export const FALLBACK_CLIENT_NAME = 'Клиент из приложения';

interface ProviderRow {
  provider: string;
  providerId: string;
  email: string | null;
  displayName: string | null;
}

export async function clientIdentity(
  prisma: PrismaService,
  userId: bigint,
  clientAlias: string | null,
): Promise<ClientIdentity> {
  const [user, raw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        recoveryEmail: true,
        recoveryEmailVerifiedAt: true,
      },
    }),
    prisma.authProvider.findMany({
      where: { userId },
      select: {
        provider: true,
        providerId: true,
        email: true,
        displayName: true,
      },
      orderBy: { id: 'desc' },
    }),
  ]);
  const rows: ProviderRow[] = raw.map((r) => decryptAuthProviderRow(r));
  const telegramId = telegramIdOf(userId, rows);
  const name =
    [
      decryptName(clientAlias),
      user?.firstName,
      ...rows.map((r) => r.displayName),
    ]
      .map((s) => s?.trim())
      .find((s): s is string => !!s) ?? FALLBACK_CLIENT_NAME;
  const verifiedRecovery =
    user?.recoveryEmailVerifiedAt && user.recoveryEmail
      ? user.recoveryEmail
      : null;
  const email = emailOf(rows) ?? verifiedRecovery;
  const base = { name: name.slice(0, NAME_MAX), telegramId };
  if (telegramId !== null)
    return { ...base, contact: telegramLink(telegramId), channel: 'telegram' };
  if (email) return { ...base, contact: email, channel: 'email' };
  return { ...base, contact: `аккаунт ${userId} в приложении` };
}

/** Ссылка на человека в Telegram по id — открывает чат с ним у владельца. */
export function telegramLink(telegramId: bigint): string {
  return `tg://user?id=${telegramId}`;
}

function telegramIdOf(userId: bigint, rows: ProviderRow[]): bigint | null {
  const tg = rows.find((r) => r.provider === 'telegram');
  if (tg && /^\d{1,20}$/.test(tg.providerId)) return BigInt(tg.providerId);
  return isTelegramUserId(userId) ? userId : null;
}

function emailOf(rows: ProviderRow[]): string | null {
  for (const r of rows) {
    if (r.provider === 'email' && r.providerId.includes('@'))
      return r.providerId;
    if (r.email?.includes('@')) return r.email;
  }
  return null;
}
