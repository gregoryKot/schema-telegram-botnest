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
import { renderTemplate } from '../notification/notification.templates';
import { isQuietHours, nextQuietEnd } from '../notification/notification.time';
import { normalizeAddressForm } from '../notification/address-form';
import { describeUnknownOutcomes, sendBounded } from './telegram.send-bounded';
import { handleSendError } from './telegram.schedule-queue.errors';

export interface QueueDeps {
  bot: Telegraf<Context>;
  accountService: AccountService;
  notificationService: NotificationService;
  logger: Logger;
  /** Предел ожидания ответа Telegram; в проде — SEND_TIMEOUT_MS. */
  sendTimeoutMs?: number;
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
  const unknown: number[] = [];

  for (const notif of due) {
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
      const payload = notif.payload as Record<string, unknown> | null;
      let template: ReturnType<typeof renderTemplate>;
      try {
        template = renderTemplate(
          notif.type as NotificationType,
          payload ?? undefined,
          normalizeAddressForm(s.form),
        );
      } catch (renderErr) {
        logger.error(
          `renderTemplate threw for type=${notif.type} id=${notif.id} — skipping`,
          renderErr,
        );
        await notificationService.markSent(notif.id);
        continue;
      }
      if (!template) {
        logger.warn(
          `No template for type=${notif.type} id=${notif.id} — skipping`,
        );
        await notificationService.markSent(notif.id);
        continue;
      }
      const silent = notif.type === 'summary';
      const opts = {
        ...(template.keyboard
          ? { reply_markup: template.keyboard.reply_markup }
          : {}),
        ...(silent ? { disable_notification: true } : {}),
      };
      // Number(chatId): telegram-id заведомо меньше 2^53, а telegraf ждёт
      // number | string.
      await sendBounded(
        bot,
        Number(chatId),
        template.text,
        opts,
        deps.sendTimeoutMs,
      );
      await notificationService.markSent(notif.id);
    } catch (err: unknown) {
      await handleSendError(deps, notif.id, notif.userId, err, unknown);
    }
  }

  if (unknown.length > 0) logger.warn(describeUnknownOutcomes(unknown));

  if (noAddress.length > 0) {
    logger.warn(
      `Очередь: ${noAddress.length} уведомлений некому доставить — ` +
        `у аккаунта нет входа в Telegram. userId: ` +
        `${noAddress.slice(0, NO_ADDRESS_SAMPLE).join(', ')}` +
        `${noAddress.length > NO_ADDRESS_SAMPLE ? ' …' : ''}`,
    );
  }
}
