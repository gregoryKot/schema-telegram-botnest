import { subjectFromTitle } from '../booking/booking-notify.format';
import type { Logger } from '@nestjs/common';
import type { BookingNotifyService } from '../booking/booking-notify.service';
import type { OwnerAlert } from '../utils/owner-card';
import {
  SUBSCRIBER_IN_EMAIL,
  subPrice,
  subscriberLines,
  type OwnerSub,
} from './subscription-owner-card';

/**
 * Сигнал владельцу: деньги по ResultURL подписки пришли, а подписка уже
 * отменена (оплата по старой ссылке или списание, ушедшее до отмены). Подписку
 * код не оживляет. Telegram — без email и Telegram ID, письмо — полное.
 */
export function subscriptionPaidAfterCancelAlert(
  sub: OwnerSub,
  charge: { id: number },
  paidAmount?: number,
): OwnerAlert {
  const title = `💸 <b>Деньги за подписку #${sub.id} получены, а подписка отменена</b>`;
  const sum = paidAmount != null ? `${paidAmount} ₽` : 'сумма не указана';
  const paid = `💰 Оплачено: ${sum} (платёж #${charge.id}, подписка ${subPrice(sub)})`;
  const who = subscriberLines(sub);
  const tail =
    'Подписка отменена до этой оплаты и сама не возобновилась. Верните деньги (и аннулируйте чек в «Моём налоге») либо восстановите подписку вручную.';
  const telegram = [title, paid, ...(who.length ? [SUBSCRIBER_IN_EMAIL] : [])];
  return {
    html: {
      telegram: [...telegram, '', tail].join('\n'),
      email: [title, paid, ...who, '', tail].join('\n'),
    },
    subject: subjectFromTitle(title),
  };
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
  sub: OwnerSub,
  charge: { id: number },
  paidAmount?: number,
): Promise<void> {
  deps.logger.warn(
    `Subscription ${sub.id}: оплата после отмены, charge ${charge.id}`,
  );
  const alert = subscriptionPaidAfterCancelAlert(sub, charge, paidAmount);
  await deps.notify.notifyAdminBoth(alert.html, alert.subject);
}
