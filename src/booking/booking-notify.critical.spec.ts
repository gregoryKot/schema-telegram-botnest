// alertAdminCritical: оба канала СРАЗУ, независимо друг от друга. Обычный
// notifyAdminText шлёт почту только когда Telegram не ответил — для потерянной
// заявки (инцидент 2026-09-13) владелец потребовал письмо всегда.
import { BookingNotifyService } from './booking-notify.service';
import { lostLeadAlertText, bookingCardText } from './booking-notify.format';
import { SessionType } from '@prisma/client';

function makeService(opts: { tgOk: boolean; emailFails?: boolean }) {
  const telegram = { notifyAdmin: jest.fn(async () => opts.tgOk) };
  const email = {
    sendAdminNotification: jest.fn(async () => {
      if (opts.emailFails) throw new Error('resend 500');
    }),
  };
  const service = new BookingNotifyService(
    {} as any,
    telegram as any,
    {} as any,
    {} as any,
    email as any,
    { get: () => undefined } as any,
    {} as any,
  );
  return { service, telegram, email };
}

describe('BookingNotifyService.alertAdminCritical', () => {
  it('Telegram ответил ok — письмо всё равно уходит (это не фолбэк, а второй канал)', async () => {
    const { service, telegram, email } = makeService({ tgOk: true });
    await service.alertAdminCritical('<b>лид</b> @maria', 'Тема');
    expect(telegram.notifyAdmin).toHaveBeenCalledWith('<b>лид</b> @maria');
    expect(email.sendAdminNotification).toHaveBeenCalledWith(
      'Тема',
      'лид @maria',
    );
  });

  it('Telegram не ответил — письмо уходит, вызов не бросает', async () => {
    const { service, email } = makeService({ tgOk: false });
    await expect(
      service.alertAdminCritical('x', 'Тема'),
    ).resolves.toBeUndefined();
    expect(email.sendAdminNotification).toHaveBeenCalledTimes(1);
  });

  it('почта упала — Telegram всё равно отправлен, вызов не бросает', async () => {
    const { service, telegram } = makeService({ tgOk: true, emailFails: true });
    await expect(
      service.alertAdminCritical('x', 'Тема'),
    ).resolves.toBeUndefined();
    expect(telegram.notifyAdmin).toHaveBeenCalledTimes(1);
  });
});

describe('форматтеры уведомлений', () => {
  it('lostLeadAlertText: имя, контакт, слот, формат, сообщение и причина; HTML в данных экранирован', () => {
    const text = lostLeadAlertText(
      {
        clientName: 'Мария <b>',
        clientContact: '@maria',
        startsAt: new Date('2026-09-21T13:00:00Z'),
        durationMin: 15,
        type: SessionType.INTRO_15,
        message: 'про тревогу',
      },
      'x'.repeat(300),
    );
    expect(text).toContain('НЕ сохранилась');
    expect(text).toContain('Мария &lt;b&gt;');
    expect(text).toContain('@maria');
    expect(text).toContain('16:00 МСК');
    expect(text).toContain('15 мин');
    expect(text).toContain('про тревогу');
    expect(text).not.toContain('x'.repeat(201));
  });

  it('bookingCardText: без сообщения/ссылки строки не рисуются, источник экранирован', () => {
    const text = bookingCardText('✅ <b>Запись</b>', {
      clientName: 'Иван',
      clientContact: '+7900',
      startsAt: new Date('2026-09-21T13:00:00Z'),
      message: null,
      source: '<script>',
    });
    expect(text.split('\n')).toHaveLength(5);
    expect(text).toContain('&lt;script&gt;');
    expect(text).not.toContain('💬');
  });
});
