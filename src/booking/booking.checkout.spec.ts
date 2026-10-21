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

const row = (amount: number | null, currency = 'RUB') =>
  ({
    id: 5,
    type: SessionType.SESSION_50,
    status: BookingStatus.HELD,
    amount,
    currency,
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

describe('completeCheckout — платная не в рублях (manual)', () => {
  function manualDeps() {
    const made = makeDeps();
    const notify = {
      ...made.notify,
      onConfirmed: jest.fn(async () => undefined),
    };
    return {
      ...made,
      notify,
      deps: { ...(made.deps as object), notify } as never,
    };
  }

  it('подтверждается сразу: CONFIRMED, без ссылки на оплату, без Robokassa и «ждёт оплаты»', async () => {
    const { deps, robokassa, notify } = manualDeps();
    const res = await completeCheckout(deps, row(70, 'USD'), {
      ...OPTS,
      manual: true,
      heldUntil: null,
    });
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    expect(res.paymentUrl).toBeNull();
    expect(res.heldUntil).toBeNull();
    expect(notify.onConfirmed).toHaveBeenCalledTimes(1);
    expect(robokassa.buildPaymentUrl).not.toHaveBeenCalled();
    expect(notify.onAwaitingPayment).not.toHaveBeenCalled();
  });

  it('manual не требует Robokassa: даже выключенная и в проде не отказывает', async () => {
    const was = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { deps, robokassa } = manualDeps();
      robokassa.enabled = false;
      const res = await completeCheckout(deps, row(200, 'ILS'), {
        ...OPTS,
        manual: true,
        heldUntil: null,
      });
      expect(res.status).toBe(BookingStatus.CONFIRMED);
    } finally {
      process.env.NODE_ENV = was;
    }
  });
});
