// Аудит 2026-11, R9: отмена ОПЛАЧЕННОЙ брони приходила владельцу тем же
// «❌ Запись отменена», что и отмена неоплаченной, — о возврате денег не
// говорил ни DM, ни письмо. Теперь оплаченная (paidAt из вебхука Robokassa)
// отменяется с «нужен возврат, X ₽» в обоих каналах.
import { SessionType } from '@prisma/client';
import { BookingNotifyService } from './booking-notify.service';
import { cancelledNotice, cancelledTitle } from './booking-admin-note';

const PAID_AT = new Date('2026-11-01T10:00:00Z');

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    startsAt: new Date('2026-12-13T17:00:00Z'),
    durationMin: 50,
    type: SessionType.SESSION_50,
    clientName: 'Мария',
    clientContact: '@maria',
    message: null,
    meetingUrl: null,
    cancelToken: 'tok',
    amount: 4000,
    currency: 'RUB',
    ...overrides,
  };
}

function makeService() {
  const telegram = { notifyAdmin: jest.fn(() => Promise.resolve(true)) };
  const email = {
    sendAdminNotification: jest.fn(() => Promise.resolve(undefined)),
  };
  const calDav = { removeEvent: jest.fn(() => Promise.resolve(undefined)) };
  const service = new BookingNotifyService(
    {} as never,
    telegram as never,
    calDav as never,
    {} as never,
    email as never,
    {} as never,
  );
  return { service, telegram, email };
}

describe('cancelledTitle', () => {
  it('без оплаты — прежний заголовок, о возврате ни слова', () => {
    expect(cancelledTitle(booking())).toBe('❌ <b>Запись отменена</b>');
  });

  it('оплаченная — «нужен возврат» с суммой брони в рублях', () => {
    const title = cancelledTitle(booking({ paidAt: PAID_AT }));
    expect(title).toMatch(/нужен возврат, 4\s000 ₽/);
    // Начало прежнее: поиск DM «Запись отменена» находит и оплаченную.
    expect(title).toContain('Запись отменена');
  });

  it('оплаченная без суммы (строка до миграции amount) — просит сверить сумму', () => {
    const title = cancelledTitle(booking({ paidAt: PAID_AT, amount: null }));
    expect(title).toContain('нужен возврат');
    expect(title).toContain('сверьте в Robokassa');
  });
});

describe('cancelledNotice', () => {
  it('оплаченная: карточка + подсказка про чек, тема письма — с возвратом', () => {
    const { html, subject } = cancelledNotice(booking({ paidAt: PAID_AT }));
    // Имя — только в письме; подсказка про чек — в обоих каналах.
    expect(html.email).toContain('Мария');
    expect(html.telegram).not.toContain('Мария');
    expect(html.email).toContain('аннулируйте чек');
    expect(html.telegram).toContain('аннулируйте чек');
    expect(subject).toMatch(
      /^Запись отменена — оплачена, нужен возврат, 4\s000 ₽$/,
    );
  });

  it('неоплаченная: без подсказки, тема прежняя', () => {
    const { html, subject } = cancelledNotice(booking());
    expect(html.telegram).not.toContain('возврат');
    expect(html.email).not.toContain('возврат');
    expect(subject).toBe('Запись отменена');
  });
});

describe('BookingNotifyService.onCancelled — оплаченная бронь', () => {
  it('«нужен возврат» уходит в ОБА канала: Telegram и почту', async () => {
    const { service, telegram, email } = makeService();
    await service.onCancelled(booking({ paidAt: PAID_AT }), null);
    expect(telegram.notifyAdmin).toHaveBeenCalledWith(
      expect.stringMatching(/нужен возврат, 4\s000 ₽/),
    );
    expect(email.sendAdminNotification).toHaveBeenCalledWith(
      expect.stringMatching(/нужен возврат, 4\s000 ₽/),
      expect.stringContaining('аннулируйте чек'),
    );
  });
});
