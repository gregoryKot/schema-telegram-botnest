// Текст и разметка уведомления для отправки из очереди. Вынесено из
// telegram.schedule-queue.ts (правило №10): тело цикла выросло на темп
// отправки (429), а сборка сообщения — самостоятельный кусок.
import type { Telegram } from 'telegraf';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import { renderTemplate } from '../notification/notification.templates';
import { normalizeAddressForm } from '../notification/address-form';
import type { QueueDeps } from './telegram.schedule-queue';

type SendExtra = Parameters<Telegram['sendMessage']>[2];

interface DueRow {
  id: number;
  type: string;
  payload: unknown;
}

/** null — слать нечего; строка уже помечена отправленной, причина в логе. */
export async function renderForQueue(
  deps: Pick<QueueDeps, 'logger'> & {
    notificationService: Pick<NotificationService, 'markSent'>;
  },
  notif: DueRow,
  form: string | null | undefined,
): Promise<{ text: string; extra: SendExtra } | null> {
  const { logger, notificationService } = deps;
  const payload = notif.payload as Record<string, unknown> | null;
  let template: ReturnType<typeof renderTemplate>;
  try {
    template = renderTemplate(
      notif.type as NotificationType,
      payload ?? undefined,
      normalizeAddressForm(form),
    );
  } catch (renderErr) {
    logger.error(
      `renderTemplate threw for type=${notif.type} id=${notif.id} — skipping`,
      renderErr,
    );
    await notificationService.markSent(notif.id);
    return null;
  }
  if (!template) {
    logger.warn(`No template for type=${notif.type} id=${notif.id} — skipping`);
    await notificationService.markSent(notif.id);
    return null;
  }
  const silent = notif.type === 'summary';
  const extra = {
    ...(template.keyboard
      ? { reply_markup: template.keyboard.reply_markup }
      : {}),
    ...(silent ? { disable_notification: true } : {}),
  };
  return { text: template.text, extra };
}
