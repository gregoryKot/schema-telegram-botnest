// Загрузчик настроек отправки для пачки людей — очередь уведомлений и экран
// настроек (AccountService.getSendSettingsFor). Отдельно от send-settings.ts
// (правило №10): там форма и разбор адреса в Telegram, здесь — два запроса.
import type { PrismaService } from '../prisma/prisma.service';
import { pushReady } from '../push/push-config';
import { subscribedUserIds } from '../push/push-subscription.store';
import {
  SEND_SETTINGS_SELECT,
  toSendSettings,
  type SendSettings,
} from './send-settings';
/** У кого есть подписка на уведомления в приложении; без ключей VAPID — ни у кого. */
export async function pushedUserIds(
  prisma: Pick<PrismaService, 'pushSubscription'>,
  ids: bigint[],
): Promise<Set<string>> {
  return pushReady() ? subscribedUserIds(prisma, ids) : new Set<string>();
}

/**
 * Настройки отправки пачки людей: адрес в Telegram и наличие подписки на
 * уведомления в приложении (pushedUserIds). Два запроса параллельно, оба по индексу.
 */
export async function loadSendSettings(
  prisma: Pick<PrismaService, 'user' | 'pushSubscription'>,
  ids: bigint[],
): Promise<Map<string, SendSettings>> {
  if (ids.length === 0) return new Map();
  const [rows, pushed] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: SEND_SETTINGS_SELECT,
    }),
    pushedUserIds(prisma, ids),
  ]);
  return new Map(
    rows.map((r) => [
      r.id.toString(),
      toSendSettings(r, pushed.has(r.id.toString())),
    ]),
  );
}
