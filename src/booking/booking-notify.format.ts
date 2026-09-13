import { escapeHtml } from '../utils/escape-html';
import { SessionType } from '@prisma/client';
import { sessionLabel } from './caldav-event.util';

// Чистые форматтеры уведомлений админу о бронировании. Вынесены из
// booking-notify.service.ts (правило №10: сервис на потолке размера), чтобы
// тексты можно было проверять без сервиса и его семи зависимостей.

/** Карточка брони — общие поля для всех уведомлений админу. */
export interface BookingCard {
  clientName: string;
  clientContact: string;
  startsAt: Date;
  message: string | null;
  meetingUrl?: string | null;
  source?: string | null;
}

/**
 * Заявка, которую не удалось сохранить. Это НЕ бронь (строки в БД нет) — те
 * же поля, что человек ввёл в форму, плюс формат встречи.
 */
export interface LostLead {
  clientName: string;
  clientContact: string;
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  message?: string | null;
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

export function bookingCardText(title: string, b: BookingCard): string {
  return [
    title,
    '',
    `👤 ${b.clientName}`,
    `📬 ${b.clientContact}`,
    `🗓 ${formatTime(b.startsAt)}`,
    b.message ? `💬 ${b.message}` : null,
    b.meetingUrl ? `🔗 ${b.meetingUrl}` : null,
    b.source ? `🧭 Откуда: ${escapeHtml(b.source)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Текст «заявка потеряна» (инцидент 2026-09-13: человек семь раз жал
 * «Записаться», сервер каждый раз падал, имя и контакт не сохранялись
 * нигде, а админ получал троттлённый DM «Ошибка на сервере» без контакта).
 * Здесь всё, что нужно, чтобы связаться с человеком руками.
 */
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
