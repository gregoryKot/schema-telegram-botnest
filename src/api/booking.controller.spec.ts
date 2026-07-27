// Лид-форма /api/booking (уведомление админу, без БД): экранирование полей,
// атрибуция source («Откуда»), молчаливый дроп неполных заявок (не оракул).
import { BookingController } from './booking.controller';
import type { TelegramService } from '../telegram/telegram.service';
import type { EmailService } from '../auth/email.service';

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

  it('без имени/контакта — молча ok, уведомления не шлются', () => {
    expect(controller.submitBooking({ name: ' ', contact: '' })).toEqual({
      ok: true,
    });
    expect(notifyAdmin).not.toHaveBeenCalled();
    expect(sendAdminNotification).not.toHaveBeenCalled();
  });
});
