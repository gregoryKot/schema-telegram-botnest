import { bookingCardText, subjectFromTitle } from './booking-notify.format';
import type { PlainBooking } from './booking-notify.service';

// DM и письмо владельцу «Запись подтверждена» (ревью починки утечки ссылки на
// встречу, аудит 2026-10). Ссылку клиент на экране, по токену брони и в .ics
// больше не получает: владелец — единственный канал её доставки, и карточка
// обязана это сказать, а не оставить догадываться. Читатель — владелец, строки
// безличные (без ты/вы и без рода).

export const CONFIRMED_TITLE = '✅ <b>Запись подтверждена</b>';
export const CONFIRMED_SUBJECT = subjectFromTitle(CONFIRMED_TITLE);

export const LINK_TO_FORWARD =
  '📨 Клиент ссылку на экране не видит — её нужно переслать на контакт из брони.';
export const ROOM_REPLACED =
  '🔁 Комната клиента заменена: прежняя ссылка больше не подходит, новую стоит переслать заранее, до сессии.';
export const NO_LINK =
  '⚠ Ссылка на встречу не создана — переслать клиенту пока нечего.';

/** Строки о доставке ссылки: что переслать и сменилась ли комната. */
export function meetingDeliveryNote(
  meetingUrl: string | null | undefined,
  replaced: boolean,
): string[] {
  if (!meetingUrl) return [NO_LINK];
  return replaced ? [LINK_TO_FORWARD, ROOM_REPLACED] : [LINK_TO_FORWARD];
}

/** Полный текст карточки подтверждения: общая карточка брони + строки о ссылке. */
export function confirmedCardText(b: PlainBooking, replaced: boolean): string {
  return [
    bookingCardText(CONFIRMED_TITLE, b),
    '',
    ...meetingDeliveryNote(b.meetingUrl, replaced),
  ].join('\n');
}
