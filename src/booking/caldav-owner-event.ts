import { createHash } from 'crypto';
import { SessionType } from '@prisma/client';
import { keyedDigests } from '../utils/crypto-keys';
import { buildVcalendar, CalEvent, sessionLabel } from './caldav-event.util';
import { eventDurationMin } from './session-event';

// Событие в календаре ВЛАДЕЛЬЦА (Apple iCloud, CalDAV) — обезличенное.
// iCloud — зарубежная база: по ч. 5 ст. 18 152-ФЗ (запрос Роскомнадзора
// №08-1063539 от 11.11.2026) данные клиента туда не уходят. В событии только
// время, длительность и тип записи; номера брони нет ни в UID, ни в адресе.
// Кто придёт, контакт и текст обращения — в письме-карточке брони
// (`booking-confirmed-card.ts`) и в админке записи.
// Клиентский .ics (`booking-ics.ts`) — другой путь: файл уходит самому клиенту.

/** Всё, что CalDAV-событие владельца вправе нести: описания, места, ссылки и участников в типе нет. */
export type OwnerCalEvent = Pick<
  CalEvent,
  'uid' | 'startsAt' | 'durationMin' | 'summary'
>;

const UID_LABEL = 'booking.calDavUid.v1';

/**
 * UID события брони — HMAC номера под ENCRYPTION_KEY (без ключа, в dev, — sha256).
 * Пишется в `calDavUid`: по записанному снимаются и старые `booking-<id>@…`,
 * а этот детерминированный — запас, если под умер между PUT и записью.
 */
export function bookingEventUid(id: number): string {
  const digest =
    keyedDigests(UID_LABEL, String(id)).current ??
    createHash('sha256').update(`${UID_LABEL}:${id}`).digest('hex');
  return `${digest.slice(0, 32)}@schemehappens.ru`;
}

/** Событие владельца по брони: читает только id, время и тип — данные клиента сюда не доходят. */
export function ownerEventFor(b: {
  id: number;
  startsAt: Date;
  durationMin: number;
  type: SessionType;
}): OwnerCalEvent {
  return {
    uid: bookingEventUid(b.id),
    startsAt: b.startsAt,
    durationMin: eventDurationMin(b),
    summary: sessionLabel(b.type),
  };
}

/**
 * Тело PUT в iCloud. Поля берутся поимённо: лишнее свойство, приехавшее в
 * объекте мимо типа (спред брони, каст), в запрос не попадёт.
 */
export function buildOwnerVcalendar(ev: OwnerCalEvent): string {
  return buildVcalendar([
    {
      uid: ev.uid,
      startsAt: ev.startsAt,
      durationMin: ev.durationMin,
      summary: ev.summary,
    },
  ]);
}
