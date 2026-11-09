// Куда очередь отправит уведомление человеку прямо сейчас — ОДНА функция на
// оба места, обязанных совпадать (правило №4): очередь
// (telegram.schedule-queue.ts) и экран настроек (GET /api/settings →
// notifyChannel/notifyReachable через AccountService.notifyRoute).
//
// Правило выбора:
//   * есть хоть одна подписка на уведомления в приложении (и VAPID-ключи
//     заданы) → push, во все устройства. Пуш выигрывает у Telegram
//     намеренно: человек сам включил уведомления в приложении (экран говорит
//     «вместо Telegram»), а продукт уходит от привязки к Telegram;
//   * иначе есть адрес в Telegram → telegram;
//   * иначе null — писать некуда, очередь снимает строку «некому доставить».
// Дублирования каналов нет. Выключил уведомления в приложении — снова Telegram.
import type { Prisma } from '@prisma/client';
import { WEB_USER_ID_MIN } from '../auth/user-id-range';
import { pushReady } from '../push/push-config';
import type { SendSettings } from './send-settings';

export type NotifyChannel = 'push' | 'telegram';

export function notifyChannel(
  s: Pick<SendSettings, 'hasPush' | 'chatId'>,
): NotifyChannel | null {
  if (s.hasPush) return 'push';
  return s.chatId !== null ? 'telegram' : null;
}

export interface NotifyRoute {
  channel: NotifyChannel | null;
  /** Есть ли адрес в Telegram — экран настроек говорит «вместо Telegram». */
  telegramLinked: boolean;
}

/** Ответ экрану настроек по тем же настройкам, что читает очередь. */
export function notifyRouteOf(s: SendSettings | undefined): NotifyRoute {
  return {
    channel: s ? notifyChannel(s) : null,
    telegramLinked: (s?.chatId ?? null) !== null,
  };
}

/**
 * Кого планировщик вообще рассматривает (условие OR для User): тот же
 * выбор адреса, но в форме фильтра Prisma (getAllUsersWithSettings).
 *   * Telegram: бот не заблокирован и есть привязка к Telegram, либо номер
 *     сам телеграмный (старый пользователь бота без строки AuthProvider).
 *     Веб-номер без привязки отсекается: чата по нему нет.
 *   * Подписка на уведомления в приложении — свой адрес: с ней человек в
 *     выборке и без Telegram, и с заблокированным ботом. Без ключей VAPID
 *     слать в неё нечем — тогда ветки нет.
 */
export function notifyAudience(): Prisma.UserWhereInput[] {
  const telegram: Prisma.UserWhereInput = {
    botBlockedAt: null,
    OR: [
      { authProviders: { some: { provider: 'telegram' } } },
      { id: { lt: WEB_USER_ID_MIN } },
    ],
  };
  const push: Prisma.UserWhereInput = { pushSubscriptions: { some: {} } };
  return pushReady() ? [telegram, push] : [telegram];
}
