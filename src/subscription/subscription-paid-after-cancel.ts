import { subjectFromTitle } from '../booking/booking-notify.format';
import type { Logger } from '@nestjs/common';
import type { BookingNotifyService } from '../booking/booking-notify.service';
import { escapeHtml } from '../utils/escape-html';

/**
 * Текст сигнала владельцу: деньги по ResultURL подписки пришли, а подписка
 * уже отменена (оплата по старой ссылке или списание, ушедшее в Robokassa
 * до отмены). Подписку код не оживляет, деньги засчитаны за charge.
 * Чистый форматтер; отправка — `notifyAdminBoth` (оба канала, это деньги).
 */
export interface PaidAfterCancelSub {
  id: number;
  amount: number;
  period: string;
  telegramId: bigint | null;
  /** Уже расшифрованный email подписчика. */
  email?: string | null;
}

export function subscriptionPaidAfterCancelAlert(
  sub: PaidAfterCancelSub,
  charge: { id: number },
  paidAmount?: number,
): { html: string; subject: string } {
  const title = `💸 <b>Деньги за подписку #${sub.id} получены, а подписка отменена</b>`;
  const sum = paidAmount != null ? `${paidAmount} ₽` : 'сумма не указана';
  const html = [
    title,
    `💰 Оплачено: ${sum} (платёж #${charge.id}, подписка ${sub.amount} ₽/${sub.period === 'year' ? 'год' : 'мес'})`,
    ...(sub.email ? [`📬 ${escapeHtml(sub.email)}`] : []),
    ...(sub.telegramId ? [`👤 tg:${sub.telegramId}`] : []),
    '',
    'Подписка отменена до этой оплаты и сама не возобновилась. Верните деньги (и аннулируйте чек в «Моём налоге») либо восстановите подписку вручную.',
  ].join('\n');
  return { html, subject: subjectFromTitle(title) };
}

/**
 * Лог + сигнал в оба канала. Троттлинг не нужен: вызывается только тем
 * вебхуком, который выиграл CAS по charge, то есть один раз на charge.
 * Лог `warn`, не `error`: AlertLogger прислал бы второй DM поверх сигнала.
 */
export async function reportPaidAfterCancel(
  deps: {
    notify: Pick<BookingNotifyService, 'notifyAdminBoth'>;
    logger: Logger;
  },
  sub: PaidAfterCancelSub,
  charge: { id: number },
  paidAmount?: number,
): Promise<void> {
  deps.logger.warn(
    `Subscription ${sub.id}: оплата после отмены, charge ${charge.id}`,
  );
  const alert = subscriptionPaidAfterCancelAlert(sub, charge, paidAmount);
  await deps.notify.notifyAdminBoth(alert.html, alert.subject);
}
