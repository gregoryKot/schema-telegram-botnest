import { SessionType } from '@prisma/client';
import { escapeHtml } from '../utils/escape-html';
import { ADMIN_PANEL_URL, type OwnerNotice } from '../utils/owner-card';
import { sessionLabel } from './caldav-event.util';
import { priceLine } from './booking-notify.price';
import {
  type BookingCard,
  type LostLead,
  bookingCardText,
  formatTime,
  lostLeadAlertText,
} from './booking-notify.format';

// Карточки брони владельцу в два канала. Telegram — время, тип, номер брони,
// ссылка на нашу комнату и цена; кто придёт, контакт, текст обращения, источник
// и пояс клиента — только в письме (bookingCardText) и в панели.

/** Бронь с номером и типом — из них собирается Telegram-карточка. */
export type OwnerBooking = BookingCard & { id: number; type: SessionType };

/** Строка Telegram-карточки: где имя и контакт клиента. */
export const CLIENT_DATA_LINE = `👤 Имя и контакт — в письме на почте и в панели: ${ADMIN_PANEL_URL}`;

/** Telegram-карточка брони: без имени, контакта, текста, источника и пояса клиента. */
export function bookingTelegramCard(title: string, b: OwnerBooking): string {
  return [
    title,
    '',
    `🗓 ${formatTime(b.startsAt)} · ${sessionLabel(b.type)} · бронь #${b.id}`,
    b.meetingUrl ? `🔗 ${b.meetingUrl}` : null,
    priceLine(b),
    CLIENT_DATA_LINE,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Карточка в оба канала; `tail` — общие строки под ней, без данных человека. */
export function bookingNotice(
  title: string,
  b: OwnerBooking,
  tail: string[] = [],
): OwnerNotice {
  return {
    telegram: [bookingTelegramCard(title, b), ...tail].join('\n'),
    email: [bookingCardText(title, b), ...tail].join('\n'),
  };
}

/**
 * Заявка, которую не удалось сохранить (строки в БД нет). Telegram — слот и
 * `reason` (тип ошибки или статичная причина), письмо — всё, чтобы связаться
 * вручную, вместе с `detail` (текст ошибки может нести значения полей).
 */
export function lostLeadNotice(
  lead: LostLead,
  reason: string,
  detail?: string,
): OwnerNotice {
  const telegram = [
    '🚨 <b>Заявка на запись НЕ сохранилась — сбой сервера</b>',
    'Человек ввёл данные, но бронь не создалась. Имя и контакт — в письме на почте, связь — вручную.',
    '',
    `🗓 ${formatTime(lead.startsAt)} · ${sessionLabel(lead.type)}, ${lead.durationMin} мин`,
    '',
    `Причина: ${escapeHtml(reason)}`,
  ].join('\n');
  const full = detail ? `${reason}: ${detail}` : reason;
  return { telegram, email: lostLeadAlertText(lead, full) };
}
