// Очередь отправки уведомлений. Вынесена из telegram.schedule.service.ts
// отдельным файлом по образцу telegram.diary-complete.ts: сервис расписания
// упёрся в лимит размера (правило №10), а тело очереди — самостоятельный
// кусок с собственными исходами.
//
// Два канала: уведомление в приложение (веб-пуш, ...queue.push.ts) и Telegram.
// Какой — решает notify-channel.ts (та же функция отвечает экрану настроек);
// пауза, бюджет и тихие часы проверяются до выбора транспорта.
import { Logger } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { AccountService } from '../bot/account.service';
import { notifyChannel } from '../bot/notify-channel';
import type { PushService } from '../push/push.service';
import { sendRowByPush } from './telegram.schedule-queue.push';
import { NotificationService } from '../notification/notification.service';
import { holdBeforeSend } from './telegram.schedule-queue.gate';
import { NoAddressRows } from './telegram.schedule-queue.nowhere';
import { describeUnknownOutcomes, sendBounded } from './telegram.send-bounded';
import { handleSendError } from './telegram.schedule-queue.errors';
import { renderForQueue } from './telegram.schedule-queue.render';
import {
  QueueTick,
  type QueueTickTally,
} from './telegram.schedule-queue.tally';
import type { PaceOptions } from './telegram.paced-sender';
import type { RejectCounter } from './telegram.schedule-queue.rejects';
export { armQueueKillSwitch } from './telegram.schedule-queue.budget';

export interface QueueDeps {
  bot: Telegraf<Context>;
  accountService: AccountService;
  notificationService: NotificationService;
  logger: Logger;
  /** Предел ожидания ответа Telegram; в проде — SEND_TIMEOUT_MS. */
  sendTimeoutMs?: number;
  /** Темп и бюджет прогона; в проде — пауза 35 мс, QUEUE_TICK_BUDGET_MS. */
  pace?: PaceOptions;
  /** Итог прогона в /stats (событие notify_queue_tick). */
  track?: (tally: QueueTickTally) => Promise<void> | undefined;
  /** Отказы 400 по строкам — живёт дольше тика (E16, ...queue.rejects.ts). */
  rejects: RejectCounter;
  /** Уведомления в приложение; нет — канал push не используется. */
  push?: Pick<PushService, 'sendToUser'>;
}

export async function runProcessQueue(deps: QueueDeps): Promise<void> {
  const { bot, accountService, notificationService, logger } = deps;
  const due = await notificationService.getDue();
  if (due.length === 0) return;
  logger.log(`Processing ${due.length} due notifications`);

  const sendSettings = await accountService.getSendSettingsFor([
    ...new Set(due.map((n) => n.userId)),
  ]);
  const nowhere = new NoAddressRows(notificationService);
  const seen = { unknown: [] as number[], transient: 0 };
  const tick = new QueueTick(deps.pace);

  for (const [i, notif] of due.entries()) {
    try {
      const s = sendSettings.get(String(notif.userId));
      const channel = s ? notifyChannel(s) : null;
      if (!s || channel === null) {
        await nowhere.cancel(notif);
        continue;
      }

      // Пауза, дневной бюджет, тихие часы — telegram.schedule-queue.gate.ts.
      if (await holdBeforeSend(notificationService, notif, s)) continue;
      if (channel === 'push') {
        const left = due.length - i;
        const step = await sendRowByPush(deps, notif, s, tick, left, seen);
        if (step === 'stop') break;
        if (step === 'done') continue;
        // Подписок больше не осталось — в Telegram, если он привязан.
      }
      const chatId = s.chatId;
      if (chatId === null) {
        await nowhere.cancel(notif);
        continue;
      }
      const msg = await renderForQueue(deps, notif, s.form);
      if (!msg) continue;
      // Number(chatId): telegram-id заведомо меньше 2^53, а telegraf ждёт
      // number | string. false — Telegram просит ждать дольше, чем осталось
      // прогону: эту и следующие строки подберёт следующий тик.
      const send = () =>
        sendBounded(
          bot,
          Number(chatId),
          msg.text,
          msg.extra,
          deps.sendTimeoutMs,
        );
      if (!(await tick.send(send, due.length - i))) break;
      await notificationService.markSent(notif.id);
    } catch (err: unknown) {
      await handleSendError(deps, notif.id, notif.userId, err, seen);
    }
  }
  tick.tally.transient = seen.transient;
  tick.tally.unknown = seen.unknown.length;
  await tick.finish(logger, deps.track);
  if (seen.unknown.length > 0)
    logger.warn(describeUnknownOutcomes(seen.unknown));

  nowhere.report(logger);
}
