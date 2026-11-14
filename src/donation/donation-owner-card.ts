import { escapeHtml } from '../utils/escape-html';
import type { OwnerAlert } from '../utils/owner-card';
import { subjectFromTitle } from '../booking/booking-notify.format';

// Оплаченный донат владельцу: Telegram — номер, сумма, источник и статус;
// email и комментарий донора — только в письме.

export interface PaidDonation {
  id: number;
  amount: number;
  source: string;
  /** Уже расшифрованные поля донора. */
  email?: string | null;
  comment?: string | null;
}

export function donationPaidAlert(d: PaidDonation): OwnerAlert {
  const head = `💛 <b>Донат #${d.id}: ${d.amount} ₽</b> (${escapeHtml(d.source)}) — оплачен`;
  const extra = d.email || d.comment;
  const telegram = extra
    ? `${head}\n📧 Email и комментарий донора — в письме на почте.`
    : head;
  const email =
    head +
    (d.email ? `\n📬 ${escapeHtml(d.email)}` : '') +
    (d.comment ? `\n💬 ${escapeHtml(d.comment)}` : '');
  return { html: { telegram, email }, subject: subjectFromTitle(head) };
}
