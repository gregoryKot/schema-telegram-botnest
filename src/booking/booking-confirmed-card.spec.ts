// Ревью починки утечки ссылки на встречу (аудит 2026-10): клиент ссылку на
// экране, по токену и в .ics больше не получает — её пересылает владелец.
// Карточка «Запись подтверждена» обязана сказать это владельцу, назвать смену
// комнаты клиента и не врать, когда ссылки нет.
import { SessionType } from '@prisma/client';
import {
  CONFIRMED_SUBJECT,
  LINK_TO_FORWARD,
  NO_LINK,
  ROOM_REPLACED,
  confirmedCardText,
  meetingDeliveryNote,
} from './booking-confirmed-card';
import type { PlainBooking } from './booking-notify.service';

const booking = (meetingUrl: string | null): PlainBooking => ({
  id: 7,
  startsAt: new Date('2026-07-13T17:00:00Z'),
  durationMin: 50,
  type: SessionType.SESSION_50,
  clientName: 'Мария',
  clientContact: 'maria@example.com',
  message: null,
  meetingUrl,
  cancelToken: 'tok',
});

describe('confirmedCardText — карточка «Запись подтверждена»', () => {
  it('со ссылкой: ссылка, контакт и строка «переслать на контакт из брони»', () => {
    const text = confirmedCardText(booking('https://zoom.us/j/1?pwd=x'), false);
    expect(text.startsWith('✅ <b>Запись подтверждена</b>')).toBe(true);
    expect(text).toContain('🔗 https://zoom.us/j/1?pwd=x');
    expect(text).toContain('maria@example.com');
    expect(text.endsWith(LINK_TO_FORWARD)).toBe(true);
    expect(text).not.toContain(ROOM_REPLACED);
    expect(text).not.toContain(NO_LINK);
  });

  it('комната заменена: обе строки — переслать и что прежняя ссылка устарела', () => {
    const text = confirmedCardText(booking('https://meet.jit.si/a'), true);
    expect(text).toContain(LINK_TO_FORWARD);
    expect(text).toContain(ROOM_REPLACED);
  });

  it('без ссылки текст не врёт: ни «переслать ссылку», ни «комната заменена»', () => {
    for (const replaced of [false, true]) {
      const text = confirmedCardText(booking(null), replaced);
      expect(text).not.toContain('🔗');
      expect(text).not.toContain(LINK_TO_FORWARD);
      expect(text).not.toContain(ROOM_REPLACED);
      expect(text).toContain(NO_LINK);
    }
  });

  it('meetingDeliveryNote: пустая строка ссылки — то же, что её нет', () => {
    expect(meetingDeliveryNote('', true)).toEqual([NO_LINK]);
    expect(meetingDeliveryNote(undefined, false)).toEqual([NO_LINK]);
  });

  it('тема письма — без тегов и эмодзи, та же, что была у карточки', () => {
    expect(CONFIRMED_SUBJECT).toBe('Запись подтверждена');
  });

  // Читатель — владелец, строки безличные: формы ты/вы нет ни в одной.
  it('строки о ссылке безличны: без ты/вы', () => {
    for (const line of [LINK_TO_FORWARD, ROOM_REPLACED, NO_LINK]) {
      // \b в JS-регэкспе не видит кириллицу — граница слова явная.
      expect(line).not.toMatch(/(^|[^а-яё])(ты|вы|тебе|вам|ваш|тво)/iu);
      expect(line).not.toMatch(/[а-яё](ьте|ите)([^а-яё]|$)/iu);
    }
  });
});
