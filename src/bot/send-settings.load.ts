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
/**
 * Настройки отправки пачки людей: адрес в Telegram и наличие подписки на
 * уведомления в приложении (если ключи VAPID не заданы — подписки не в счёт:
 * слать в них нечем). Два запроса параллельно, оба по индексу.
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
    pushReady() ? subscribedUserIds(prisma, ids) : new Set<string>(),
  ]);
  return new Map(
    rows.map((r) => [
      r.id.toString(),
      toSendSettings(r, pushed.has(r.id.toString())),
    ]),
  );
}
