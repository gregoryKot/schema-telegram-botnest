import { isTelegramUserId } from '../auth/user-id-range';

// Настройки отправки уведомления — вынесено из account.service.ts (правило
// №10): очередь (telegram.schedule-queue.ts) читает их пачкой одним запросом
// с адресом в Telegram; подписки на уведомления в приложении добавляет
// загрузчик send-settings.load.ts.

/**
 * Что нужно знать про человека, чтобы отправить ему уведомление: тихие часы,
 * форма обращения и КУДА писать — два адреса: `chatId` (Telegram; null — нет
 * телеграм-входа) и `hasPush` (есть подписка на уведомления в приложении,
 * src/push/). Какой из них берёт очередь — notify-channel.ts.
 */
export interface SendSettings {
  tz: string;
  start: number;
  end: number;
  form: string | null;
  chatId: bigint | null;
  /** Есть подписка на уведомления в приложении и VAPID-ключи заданы. */
  hasPush: boolean;
  /** Пауза уведомлений (R5): очередь снимает проактивные, пока она идёт. */
  pausedUntil: Date | null;
}

/**
 * Куда писать этому аккаунту. Сначала — привязка AuthProvider (единственный
 * верный ответ для слитых аккаунтов и для входов через сайт). Если привязки
 * нет, а сам номер лежит в телеграмном диапазоне — это старый пользователь
 * бота, которому строку AuthProvider никогда не заводили (её создаёт вход в
 * мини-апп или на сайте). Таких большинство, и их адрес — сам userId.
 *
 * `null` остаётся только у веб-номеров без привязки: чата по такому номеру
 * не существует в принципе.
 */
function resolveChatId(
  userId: bigint,
  providerId: string | undefined,
): bigint | null {
  if (providerId !== undefined) {
    try {
      return BigInt(providerId);
    } catch {
      return isTelegramUserId(userId) ? userId : null;
    }
  }
  return isTelegramUserId(userId) ? userId : null;
}

/** Что очередь читает про человека — одним запросом с адресом. */
export const SEND_SETTINGS_SELECT = {
  id: true,
  notifyTimezone: true,
  notifyQuietStart: true,
  notifyQuietEnd: true,
  notifyPausedUntil: true,
  addressForm: true,
  // Адрес берём тем же запросом, что и настройки: очередь читает и то и
  // другое на одном тике, второй роундтрип здесь был бы дублем механики.
  authProviders: {
    where: { provider: 'telegram' },
    select: { providerId: true },
    orderBy: { id: 'desc' },
    take: 1,
  },
} as const;

export function toSendSettings(
  r: {
    id: bigint;
    notifyTimezone: string;
    notifyQuietStart: number;
    notifyQuietEnd: number;
    notifyPausedUntil?: Date | null;
    addressForm: string | null;
    authProviders?: { providerId: string }[];
  },
  hasPush = false,
): SendSettings {
  return {
    tz: r.notifyTimezone,
    start: r.notifyQuietStart,
    end: r.notifyQuietEnd,
    form: r.addressForm,
    chatId: resolveChatId(r.id, r.authProviders?.[0]?.providerId),
    hasPush,
    pausedUntil: r.notifyPausedUntil ?? null,
  };
}
