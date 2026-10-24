// Очередь отправки уведомлений. Вынесена из telegram.schedule.service.ts
// отдельным файлом по образцу telegram.diary-complete.ts: сервис расписания
// упёрся в лимит размера (правило №10), а тело очереди — самостоятельный
// кусок с собственными исходами.
import { Logger } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { AccountService } from '../bot/account.service';
import {
  NotificationService,
  QUIET_EXEMPT_TYPES,
  NotificationType,
} from '../notification/notification.service';
import { isQuietHours, nextQuietEnd } from '../notification/notification.time';
import { describeUnknownOutcomes, sendBounded } from './telegram.send-bounded';
import { handleSendError } from './telegram.schedule-queue.errors';
import { renderForQueue } from './telegram.schedule-queue.render';
import {
  QueueTick,
  type QueueTickTally,
} from './telegram.schedule-queue.tally';
import type { PaceOptions } from './telegram.paced-sender';
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
}

// Сколько userId показать в итоговой строке про «некуда слать»: авария — это
// поток, и сотня строк в логе равна замьюченному логу (урок 2026-07-29).
const NO_ADDRESS_SAMPLE = 5;

export async function runProcessQueue(deps: QueueDeps): Promise<void> {
  const { bot, accountService, notificationService, logger } = deps;
  const due = await notificationService.getDue();
  if (due.length === 0) return;
  logger.log(`Processing ${due.length} due notifications`);

  const sendSettings = await accountService.getSendSettingsFor([
    ...new Set(due.map((n) => n.userId)),
  ]);
  const noAddress: string[] = [];
  const seen = { unknown: [] as number[], transient: 0 };
  const tick = new QueueTick(deps.pace);

  for (const [i, notif] of due.entries()) {
    try {
      const s = sendSettings.get(String(notif.userId));

      // Писать некуда: у человека нет телеграм-входа (Google, почта, MAX) либо
      // аккаунт слит, и адрес уехал вместе с AuthProvider. Отменяем строку —
      // именно cancelledAt, а не markSent: sentAt читает lastSentAt(), на нём
      // стоит каденс, и «отправлено» без отправки сдвинуло бы расписание.
      // И ни в коем случае не markUserBlocked: человек бота не блокировал.
      if (!s || s.chatId === null) {
        await notificationService.cancelOne(notif.id);
        noAddress.push(String(notif.userId));
        continue;
      }
      const chatId = s.chatId;

      // Тихие часы: проактивные придерживаем до утра. Покрывает и catch-up после
      // даунтайма — уведомление за 21:00 не улетит в 3 ночи.
      if (!QUIET_EXEMPT_TYPES.includes(notif.type as NotificationType)) {
        if (isQuietHours(s.tz, s.start, s.end)) {
          await notificationService.defer(notif.id, nextQuietEnd(s.tz, s.end));
          continue;
        }
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
  await tick.finish(logger, deps.track);

  if (seen.unknown.length > 0) {
    logger.warn(describeUnknownOutcomes(seen.unknown));
  }

  if (noAddress.length > 0) {
    logger.warn(
      `Очередь: ${noAddress.length} уведомлений некому доставить — ` +
        `у аккаунта нет входа в Telegram. userId: ` +
        `${noAddress.slice(0, NO_ADDRESS_SAMPLE).join(', ')}` +
        `${noAddress.length > NO_ADDRESS_SAMPLE ? ' …' : ''}`,
    );
  }
}
