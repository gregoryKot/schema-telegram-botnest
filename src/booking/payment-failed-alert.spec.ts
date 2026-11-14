// РКН (#1135): деньги пришли, а бронь не подтвердилась — владельцу уходит
// номер брони, тип ошибки и id строки в логе, но не текст ошибки (в нём бывают
// аргументы запроса Prisma и ответ площадки). Шов целиком: ветка вебхука →
// настоящий Logger → AlertLogger → notifyAdminWithFallback (замокан на границе).
import { Logger } from '@nestjs/common';
import { AlertLogger } from '../logger/alert.logger';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { bookingWebhookReply } from './payment.booking-webhook';
import { paidButFailedAlert } from './payment-failed-alert';
import { PaymentAfterCancelError } from './booking.transitions';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const dm = notifyAdminWithFallback as jest.Mock;
const MARK = /MARK|poison|Ivanov/;
const poisoned = () =>
  new TypeError('MARK: { email: "ivan@poison.test", name: "Ivanov" }');
const flush = () => new Promise((r) => setImmediate(r));

let stderr: jest.SpyInstance;
beforeAll(() => Logger.overrideLogger(new AlertLogger()));
beforeEach(() => {
  dm.mockClear();
  stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterEach(() => stderr.mockRestore());

function deps(confirm: jest.Mock, notifyAdminBoth = jest.fn()) {
  const notify = { alertAdmin: jest.fn(), notifyAdminBoth };
  return {
    notify,
    run: () =>
      bookingWebhookReply(
        {
          booking: { confirm } as never,
          notify: notify as never,
          logger: new Logger('PaymentController'),
        },
        7,
        '7',
        4000,
      ),
  };
}

const logged = () => stderr.mock.calls.map((c) => String(c[0])).join('');

describe('paidButFailedAlert', () => {
  it('что не подтвердилось и тип ошибки — без её текста', () => {
    const text = paidButFailedAlert('бронь #7 не подтвердилась', poisoned());
    expect(text).toContain('бронь #7 не подтвердилась');
    expect(text).toContain('Тип ошибки: TypeError');
    expect(text).not.toMatch(MARK);
  });
});

describe('bookingWebhookReply — в Telegram нет текста ошибки', () => {
  it('оплата прошла, бронь не подтвердилась: оба сообщения без маркеров, текст — в логе', async () => {
    const { notify, run } = deps(jest.fn().mockRejectedValue(poisoned()));
    await expect(run()).resolves.toBe('FAIL7');
    await flush();

    const card = String(notify.alertAdmin.mock.calls[0][0]);
    expect(card).toContain('бронь #7 не подтвердилась');
    expect(card).not.toMatch(MARK);

    const alert = String(dm.mock.calls[0][0]);
    expect(alert).toContain('💰 PAID but confirm failed for booking 7');
    expect(alert).toContain('Место: PaymentController\nТип: TypeError');
    expect(alert).not.toMatch(MARK);
    expect(logged()).toContain('ivan@poison.test');
  });

  it('оплата после отмены, сигнал владельцу не ушёл: DM без текста ошибки доставки', async () => {
    const afterCancel = new PaymentAfterCancelError(
      {
        id: 7,
        startsAt: new Date('2026-07-13T17:00:00Z'),
        durationMin: 50,
        type: 'SESSION_50',
        clientName: 'Мария',
        clientContact: '@maria',
        message: null,
      } as never,
      4000,
    );
    const { run } = deps(
      jest.fn().mockRejectedValue(afterCancel),
      jest.fn().mockRejectedValue(poisoned()),
    );
    await expect(run()).resolves.toBe('FAIL7');
    await flush();

    const alert = String(dm.mock.calls[0][0]);
    expect(alert).toContain('💰 PAID after cancel, booking 7');
    expect(alert).toContain('Тип: TypeError');
    expect(alert).not.toMatch(MARK);
    expect(logged()).toContain('ivan@poison.test');
  });
});
