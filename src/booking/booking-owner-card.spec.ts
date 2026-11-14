// Карточки брони владельцу: в Telegram не уходит ни одного значения, которое
// ввёл человек (имя, контакт, текст, источник, пояс), и ни текста ошибки;
// письмо по-прежнему несёт всё, чтобы связаться вручную.
import { SessionType } from '@prisma/client';
import { PII, expectNoMarkers } from '../test-support/pii-markers';
import {
  CLIENT_DATA_LINE,
  bookingNotice,
  lostLeadNotice,
} from './booking-owner-card';
import { confirmedNotice } from './booking-confirmed-card';
import { cancelledNotice } from './booking-admin-note';
import { paidAfterCancelAlert } from './booking-paid-after-cancel';
import type { PlainBooking } from './booking-notify.service';
import type { OwnerNotice } from '../utils/owner-card';

const ROOM = 'https://zoom.us/j/555?pwd=room';

const marked = (over: Partial<PlainBooking> = {}): PlainBooking => ({
  id: 42,
  startsAt: new Date('2026-12-01T17:00:00Z'),
  durationMin: 50,
  type: SessionType.SESSION_50,
  clientName: PII.name,
  clientContact: PII.contact,
  clientChannel: 'telegram',
  message: PII.message,
  meetingUrl: ROOM,
  cancelToken: 'tok',
  source: PII.source,
  clientTimeZone: PII.timeZone,
  amount: 70,
  currency: 'USD',
  createdAt: new Date('2026-11-10T00:00:00Z'),
  ...over,
});

const PAID = { paidAt: new Date(), amount: 3000, currency: 'RUB' };

const CARDS: Record<string, () => OwnerNotice> = {
  'напоминание / ожидание оплаты / истекла': () =>
    bookingNotice('⏰ <b>Напоминание: сессия завтра</b>', marked()),
  'запись подтверждена': () => confirmedNotice(marked(), true),
  'отмена оплаченной': () => cancelledNotice(marked(PAID)).html,
  'деньги после отмены': () => paidAfterCancelAlert(marked(), 3000).html,
};

describe.each(Object.entries(CARDS))('карточка брони: %s', (_name, make) => {
  it('Telegram — без данных человека: номер, время МСК, комната и путь к данным', () => {
    const { telegram } = make();
    expectNoMarkers(telegram);
    expect(telegram).toContain('#42');
    expect(telegram).toContain('МСК');
    expect(telegram).toContain(ROOM);
    expect(telegram).toContain(CLIENT_DATA_LINE);
    expect(CLIENT_DATA_LINE).toContain('https://schemehappens.ru/admin');
  });

  it('письмо — имя, контакт, текст обращения и источник на месте', () => {
    const { email } = make();
    for (const m of [PII.name, PII.contact, PII.message, PII.source]) {
      expect(email).toContain(m);
    }
  });
});

describe('lostLeadNotice — заявка на запись не сохранилась', () => {
  const lead = {
    clientName: PII.name,
    clientContact: PII.contact,
    clientChannel: 'phone',
    startsAt: new Date('2026-12-01T17:00:00Z'),
    durationMin: 50,
    type: SessionType.SESSION_50,
    message: PII.message,
  };

  it('Telegram — слот и тип ошибки, без данных человека и текста ошибки', () => {
    const n = lostLeadNotice(
      lead,
      'PrismaClientKnownRequestError P1001',
      PII.error,
    );
    expectNoMarkers(n.telegram);
    expect(n.telegram).toContain('НЕ сохранилась');
    expect(n.telegram).toContain('P1001');
    expect(n.telegram).toContain('МСК');
    expect(n.telegram).toContain('в письме на почте');
  });

  it('письмо — имя, контакт, текст и сообщение ошибки, чтобы связаться вручную', () => {
    const n = lostLeadNotice(lead, 'Error', PII.error);
    for (const m of [PII.name, PII.contact, PII.message, PII.error]) {
      expect(n.email).toContain(m);
    }
  });

  it('статичная причина без подробностей — одна и та же в обоих каналах', () => {
    const n = lostLeadNotice(lead, 'оплата не настроена');
    expect(n.telegram).toContain('Причина: оплата не настроена');
    expect(n.email).toContain('Причина: оплата не настроена');
  });
});
