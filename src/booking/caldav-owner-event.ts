import { SessionType } from '@prisma/client';
import { buildVcalendar, CalEvent, sessionLabel } from './caldav-event.util';
import { eventDurationMin } from './session-event';

// Событие в календаре ВЛАДЕЛЬЦА (Apple iCloud, CalDAV) — обезличенное.
// iCloud — зарубежная база: по ч. 5 ст. 18 152-ФЗ (запрос Роскомнадзора
// №08-1063539 от 11.11.2026) данные клиента туда не уходят. В событии только
// время, длительность, тип записи и номер брони в UID. Кто придёт, контакт,
// текст обращения и ссылку на встречу владелец видит в карточке брони
// (Telegram и почта, `booking-confirmed-card.ts`) и в админке записи.
// Клиентский .ics (`booking-ics.ts`) — другой путь: файл уходит самому клиенту.

/** Всё, что CalDAV-событие владельца вправе нести: описания, места, ссылки и участников в типе нет. */
export type OwnerCalEvent = Pick<
  CalEvent,
  'uid' | 'startsAt' | 'durationMin' | 'summary'
>;

/** Детерминированный UID события брони: по нему событие снимается и без записанного calDavUid. */
export const bookingEventUid = (id: number): string =>
  `booking-${id}@schemehappens.ru`;

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
