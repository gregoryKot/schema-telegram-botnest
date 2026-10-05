// Лид-форма /api/booking (уведомление админу, без БД): экранирование полей,
// атрибуция source («Откуда»), молчаливый дроп неполных заявок (не оракул).
import { BookingController } from './booking.controller';
import type { TelegramService } from '../telegram/telegram.service';
import type { EmailService } from '../auth/email.service';
import { PERSISTENT_THROTTLE_KEY } from './persistent-throttle.decorator';

describe('BookingController.submitBooking', () => {
  let notifyAdmin: jest.Mock;
  let sendAdminNotification: jest.Mock;
  let controller: BookingController;

  beforeEach(() => {
    notifyAdmin = jest.fn().mockResolvedValue(true);
    sendAdminNotification = jest.fn().mockResolvedValue(undefined);
    controller = new BookingController(
      { notifyAdmin } as unknown as TelegramService,
      { sendAdminNotification } as unknown as EmailService,
    );
  });

  it('уведомляет Telegram и e-mail, HTML в полях экранирован', () => {
    expect(
      controller.submitBooking({
        name: 'Мария <b>',
        contact: '@maria',
        message: 'Привет',
      }),
    ).toEqual({ ok: true });
    const tg = notifyAdmin.mock.calls[0][0] as string;
    expect(tg).toContain('Мария &lt;b&gt;');
    expect(tg).toContain('@maria');
    expect(tg).toContain('Привет');
    expect(sendAdminNotification).toHaveBeenCalled();
  });

  it('source попадает строкой «Откуда» — экранированный и обрезанный до 200', () => {
    controller.submitBooking({
      name: 'Имя',
      contact: '@c',
      source: `<i>${'x'.repeat(300)}</i>`,
    });
    const tg = notifyAdmin.mock.calls[0][0] as string;
    expect(tg).toContain('Откуда:');
    expect(tg).toContain('&lt;i&gt;');
    expect(tg).not.toContain('<i>');
    // Обрезка до 200 символов исходной строки: '<i>' + 197 «x».
    expect(tg).toContain('x'.repeat(197));
    expect(tg).not.toContain('x'.repeat(198));
  });

  it('без source строки «Откуда» в уведомлении нет', () => {
    controller.submitBooking({ name: 'Имя', contact: '@c' });
    expect(notifyAdmin.mock.calls[0][0]).not.toContain('Откуда');
  });

  it('канал whatsapp: в DM и письме подпись «WhatsApp:» и номер', () => {
    controller.submitBooking({
      name: 'Имя',
      contact: '+79990001122',
      channel: 'whatsapp',
    });
    expect(notifyAdmin.mock.calls[0][0]).toContain(
      '<b>WhatsApp:</b> +79990001122',
    );
    expect(sendAdminNotification.mock.calls[0][1]).toContain(
      'WhatsApp: +79990001122',
    );
    expect(notifyAdmin.mock.calls[0][0]).not.toContain('Контакт:');
  });

  it('без канала по-прежнему «Контакт:»', () => {
    controller.submitBooking({ name: 'Имя', contact: '+79990001122' });
    expect(notifyAdmin.mock.calls[0][0]).toContain('<b>Контакт:</b>');
    expect(sendAdminNotification.mock.calls[0][1]).toContain(
      'Контакт: +79990001122',
    );
  });

  it('без имени/контакта — молча ok, уведомления не шлются', () => {
    expect(controller.submitBooking({ name: ' ', contact: '' })).toEqual({
      ok: true,
    });
    expect(notifyAdmin).not.toHaveBeenCalled();
    expect(sendAdminNotification).not.toHaveBeenCalled();
  });
});

// M4 (аудит 2026-10): лид-форма без собственного лимита давала спамить админу
// DM и письмами. Метаданные читаем напрямую, как расставляют декораторы.
describe('BookingController.submitBooking — троттлинг (M4)', () => {
  it('@Throttle long: 6 заявок в час с одного адреса', () => {
    const handler = BookingController.prototype.submitBooking;
    expect(Reflect.getMetadata('THROTTLER:LIMITlong', handler)).toBe(6);
    expect(Reflect.getMetadata('THROTTLER:TTLlong', handler)).toBe(3_600_000);
  });

  it('@PersistentThrottle(): счётчик общий на все инстансы (Postgres)', () => {
    expect(
      Reflect.getMetadata(
        PERSISTENT_THROTTLE_KEY,
        BookingController.prototype.submitBooking,
      ),
    ).toBe(true);
  });
});
