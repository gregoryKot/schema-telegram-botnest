import { escapeHtml } from '../utils/escape-html';
import type { OwnerAlert } from '../utils/owner-card';
import { subjectFromTitle } from '../booking/booking-notify.format';

// Подписка у владельца: Telegram — событие, номер подписки и платежа, сумма и
// статус; email и Telegram ID подписчика — только в письме, ответ Robokassa —
// только в логе приложения.

export interface OwnerSub {
  id: number;
  amount: number;
  period: string;
  telegramId: bigint | null;
  /** Уже расшифрованный email подписчика. */
  email?: string | null;
}

/** Строка Telegram-карточки: где данные подписчика. */
export const SUBSCRIBER_IN_EMAIL = '📧 Email подписчика — в письме на почте.';

/** «1490 ₽/мес». */
export const subPrice = (sub: Pick<OwnerSub, 'amount' | 'period'>): string =>
  `${sub.amount} ₽/${sub.period === 'year' ? 'год' : 'мес'}`;

/** Данные подписчика — строки только для письма. */
export function subscriberLines(sub: OwnerSub): string[] {
  return [
    ...(sub.email ? [`📬 ${escapeHtml(sub.email)}`] : []),
    ...(sub.telegramId ? [`👤 tg:${sub.telegramId}`] : []),
  ];
}

/** Оплаченное списание (новая подписка или продление) в оба канала. */
export function subscriptionChargedAlert(
  sub: OwnerSub,
  charge: { id: number; isFirst: boolean },
): OwnerAlert {
  const event = charge.isFirst ? 'Новая подписка' : 'Продление подписки';
  const title = `${charge.isFirst ? '🎉' : '🔁'} <b>${event} #${sub.id}</b> ${subPrice(sub)}`;
  const head = `${title}\nПлатёж #${charge.id} — оплачен`;
  const who = subscriberLines(sub);
  const telegram = who.length ? `${head}\n${SUBSCRIBER_IN_EMAIL}` : head;
  return {
    html: { telegram, email: [head, ...who].join('\n') },
    subject: subjectFromTitle(title),
  };
}

/** Сбой рекуррентного списания: текст ответа Robokassa сюда не попадает. */
export function chargeFailedText(
  subId: number,
  chargeId: number,
  fails: number,
  maxFails: number,
): string {
  return (
    `⚠️ <b>Не удалось списать подписку #${subId}</b> (${fails}/${maxFails}), платёж #${chargeId}\n` +
    'Ответ Robokassa — в логе приложения.'
  );
}
