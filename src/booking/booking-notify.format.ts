import { escapeHtml } from '../utils/escape-html';
import { SessionType } from '@prisma/client';
import { sessionLabel } from './caldav-event.util';
import { clientTimeLine } from './client-timezone';

// Чистые форматтеры уведомлений админу о бронировании — вынесены из
// booking-notify.service.ts (правило №10), проверяются без сервиса и его зависимостей.

/** Карточка брони — общие поля для всех уведомлений админу. */
export interface BookingCard {
  clientName: string;
  clientContact: string;
  startsAt: Date;
  message: string | null;
  meetingUrl?: string | null;
  source?: string | null;
  /** IANA-пояс посетителя (если собрался и не совпадает с московским). */
  clientTimeZone?: string | null;
}

/** Заявка, которую не удалось сохранить (НЕ бронь — строки в БД нет). */
export interface LostLead {
  clientName: string;
  clientContact: string;
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  message?: string | null;
}

/** Тема письма из title уведомления: без HTML-тегов и эмодзи (иконки — для Telegram, не для строки темы). */
export function subjectFromTitle(title: string): string {
  return title
    .replace(/<[^>]+>|\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTime(date: Date): string {
  return (
    new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date) + ' МСК'
  );
}

/** «вт, 30 сент., 15:00 МСК» либо, если посетитель прислал непустой не-МСК
 * пояс, «вт, 30 сент., 15:00 МСК · у клиента 19:00 (Бангкок, UTC+7)». */
function timeWithClientTz(
  b: Pick<BookingCard, 'startsAt' | 'clientTimeZone'>,
): string {
  const line = clientTimeLine(b.startsAt, b.clientTimeZone);
  return line ? `${formatTime(b.startsAt)} · ${line}` : formatTime(b.startsAt);
}

export function bookingCardText(title: string, b: BookingCard): string {
  return [
    title,
    '',
    `👤 ${b.clientName}`,
    `📬 ${b.clientContact}`,
    `🗓 ${timeWithClientTz(b)}`,
    b.message ? `💬 ${b.message}` : null,
    b.meetingUrl ? `🔗 ${b.meetingUrl}` : null,
    b.source ? `🧭 Откуда: ${escapeHtml(b.source)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

// Текст «заявка потеряна» (инцидент 2026-09-13: контакт терялся при сбое
// сервера) — всё нужное, чтобы связаться с человеком руками.
export function lostLeadAlertText(lead: LostLead, reason: string): string {
  return [
    '🚨 <b>Заявка на запись НЕ сохранилась — сбой сервера</b>',
    'Человек ввёл данные, но бронь не создалась. Свяжитесь с ним вручную.',
    '',
    `👤 ${escapeHtml(lead.clientName)}`,
    `📬 ${escapeHtml(lead.clientContact)}`,
    `🗓 ${formatTime(lead.startsAt)} · ${sessionLabel(lead.type)}, ${lead.durationMin} мин`,
    lead.message ? `💬 ${escapeHtml(lead.message)}` : null,
    '',
    `Причина: ${escapeHtml(reason.slice(0, 200))}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
