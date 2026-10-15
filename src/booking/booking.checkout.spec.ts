// completeCheckout платит по сумме счёта, сохранённой в брони (Booking.amount),
// а не по повторному чтению цены (аудит 2026-10-11). Платная бронь без суммы —
// нарушение инварианта: book() отказывает до INSERT, но второй рубеж обязан
// не выставить счёт «наугад».
import { BookingStatus, SessionType } from '@prisma/client';
import { completeCheckout } from './booking.checkout';

const OPTS = {
  isFree: false,
  cancelToken: 'tok',
  heldUntil: new Date('2026-10-20T10:15:00Z'),
  startsAt: new Date('2026-10-20T10:00:00Z'),
  clientContact: 'a@b.co',
};

function makeDeps() {
  const robokassa = {
    enabled: true,
    buildPaymentUrl: jest.fn(() => 'https://pay.example/x'),
  };
  const notify = { onAwaitingPayment: jest.fn(async () => undefined) };
  const deps = {
    prisma: {},
    notify,
    robokassa,
    siteUrl: 'https://schemehappens.ru',
    schema: { strings: [] },
  };
  return { deps: deps as never, robokassa, notify };
}

const row = (amount: number | null) =>
  ({
    id: 5,
    type: SessionType.SESSION_50,
    status: BookingStatus.HELD,
    amount,
  }) as never;

describe('completeCheckout — сумма счёта из брони', () => {
  it('в Robokassa уходит Booking.amount', async () => {
    const { deps, robokassa } = makeDeps();
    const res = await completeCheckout(deps, row(4200), OPTS);
    expect(res.paymentUrl).toBe('https://pay.example/x');
    expect(robokassa.buildPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ invId: 5, amount: 4200 }),
    );
  });

  it('платная бронь без amount: бросок, счёт не строится, админу не пишем «ждёт оплаты»', async () => {
    const { deps, robokassa, notify } = makeDeps();
    await expect(completeCheckout(deps, row(null), OPTS)).rejects.toThrow(
      'Booking 5 has no invoiced amount',
    );
    expect(robokassa.buildPaymentUrl).not.toHaveBeenCalled();
    expect(notify.onAwaitingPayment).not.toHaveBeenCalled();
  });
});
