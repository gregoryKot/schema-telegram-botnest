// Строка очереди → сообщение в Telegram. Вынесено из telegram.schedule-queue.ts
// (правило №10): цикл очереди вырос на захват строки (backend#15), а шаг
// Telegram — самостоятельный кусок, как шаг пуша (...queue.push.ts).
//
// Строка уже захвачена этим прогоном (notification-claim.ts). Исходы:
//   нет адреса   → «некому доставить» (cancelledAt, telegram.schedule-queue.nowhere.ts);
//   нет шаблона  → помечено отправленным в renderForQueue, причина в логе;
//   ушло         → markSent;
//   stop         → Telegram просит ждать дольше, чем осталось прогону, или
//                  кончился бюджет: строку и хвост подберёт следующий тик.
// Ошибки отправки пробрасываются — их разбирает handleSendError.
import type { DueNotification } from '../notification/notification.service';
import type { SendSettings } from '../bot/send-settings';
import type { QueueDeps } from './telegram.schedule-queue';
import type { NoAddressRows } from './telegram.schedule-queue.nowhere';
import type { RowStep } from './telegram.schedule-queue.push';
import { renderForQueue } from './telegram.schedule-queue.render';
import type { QueueTick } from './telegram.schedule-queue.tally';
import { sendBounded } from './telegram.send-bounded';

export async function sendRowByTelegram(
  deps: QueueDeps,
  notif: DueNotification,
  s: SendSettings,
  tick: QueueTick,
  left: number,
  nowhere: NoAddressRows,
): Promise<Extract<RowStep, 'done' | 'stop'>> {
  if (s.chatId === null) {
    await nowhere.cancel(notif);
    return 'done';
  }
  const msg = await renderForQueue(deps, notif, s.form);
  if (!msg) return 'done';
  // Number(chatId): telegram-id заведомо меньше 2^53, а telegraf ждёт
  // number | string.
  const chatId = Number(s.chatId);
  const send = () =>
    sendBounded(deps.bot, chatId, msg.text, msg.extra, deps.sendTimeoutMs);
  if (!(await tick.send(send, left))) return 'stop';
  await deps.notificationService.markSent(notif.id);
  return 'done';
}
