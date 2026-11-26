// completeCheckout платит по сумме счёта, сохранённой в брони (Booking.amount),
// а не по повторному чтению цены (аудит 2026-10-11). Платная бронь без суммы —
// нарушение инварианта: book() отказывает до INSERT, но второй рубеж обязан
// не выставить счёт «наугад».
import { Logger } from '@nestjs/common';
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
  const logger = new Logger('test');
  const deps = {
    prisma: {},
    notify,
    robokassa,
    siteUrl: 'https://schemehappens.ru',
    schema: { strings: [] },
    logger,
  };
  return { deps: deps as never, robokassa, notify, logger };
}

const row = (
  amount: number | null,
  currency = 'RUB',
  type: SessionType = SessionType.SESSION_50,
) =>
  ({
    id: 5,
    type,
    durationMin: 50,
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

// Аудит 2026-10 (утечка ссылки на встречу): ручка записи анонимная, а комната
// клиента ищется по контакту — ответ не несёт ссылку ни на одном пути, даже
// когда подтверждение уже проставило её в брони. Форма ответа одна на всех
// путях (инвариант #662: тело не различает пути).
describe('completeCheckout — ответ без ссылки на встречу', () => {
  const KEYS = [
    'cancelToken',
    'eventDurationMin',
    'heldUntil',
    'id',
    'paymentUrl',
    'status',
  ];

  it('сразу подтверждённая бронь со ссылкой в строке — в ответе ссылки нет', async () => {
    const { deps } = makeDeps();
    const notify = { onConfirmed: jest.fn(async () => undefined) };
    const withLink = {
      ...(row(70, 'EUR') as object),
      meetingUrl: 'https://zoom.example/j/1?pwd=secret',
    } as never;
    const res = await completeCheckout(
      { ...(deps as object), notify } as never,
      withLink,
      { ...OPTS, manual: true, heldUntil: null },
    );
    expect(Object.keys(res).sort()).toEqual(KEYS);
    expect(JSON.stringify(res)).not.toContain('pwd=secret');
  });

  it('платная в рублях (HELD) — те же ключи', async () => {
    const { deps } = makeDeps();
    const res = await completeCheckout(deps, row(4200), OPTS);
    expect(Object.keys(res).sort()).toEqual(KEYS);
  });
});

// Аудит 2026-11, R9: экран сразу после записи брал длину из слота (50), и
// ссылка «в Google Календарь» у знакомства стояла на 50 минут, а .ics и
// страница записи — на 15. Длину встречи отдаёт сервер, один источник правды —
// eventDurationMin (session-event.ts).
describe('completeCheckout — длина встречи в ответе', () => {
  it('знакомство в слоте 50 → eventDurationMin 15 (сразу подтверждено)', async () => {
    const { deps } = makeDeps();
    const notify = { onConfirmed: jest.fn(async () => undefined) };
    const res = await completeCheckout(
      { ...(deps as object), notify } as never,
      row(null, 'RUB', SessionType.INTRO_15),
      { ...OPTS, isFree: true, heldUntil: null },
    );
    expect(res.eventDurationMin).toBe(15);
  });

  it('контрольный: сессия 50 (ждёт оплаты) → 50', async () => {
    const { deps } = makeDeps();
    const res = await completeCheckout(deps, row(4200), OPTS);
    expect(res.eventDurationMin).toBe(50);
  });
});

// security (docs/open/security.md, «Время ответа POST /api/booking/book выдаёт,
// клиент ли контакт»): эффекты подтверждения (встреча, календарь, DM) идут
// после ответа. createMeeting для нового контакта при Zoom — два HTTP-вызова,
// для клиента — одно чтение: ожидание внутри запроса отвечало на тот же
// вопрос, что закрытый оракул #662. Недоделанное добирает крон по
// confirmEffectsDoneAt (booking-confirm-retry.service.ts).
describe('completeCheckout — эффекты подтверждения после ответа', () => {
  const free = { ...OPTS, isFree: true, heldUntil: null };
  const confirmDeps = (onConfirmed: jest.Mock) => {
    const made = makeDeps();
    const notify = { ...made.notify, onConfirmed };
    return {
      ...made,
      deps: { ...(made.deps as object), notify } as never,
    };
  };

  it('ответ не ждёт notify.onConfirmed: эффекты висят — CONFIRMED уже отдан', async () => {
    const onConfirmed = jest.fn(() => new Promise<void>(() => {}));
    const { deps } = confirmDeps(onConfirmed);
    const hung = new Promise((r) => setTimeout(() => r('hung'), 50));
    const res = await Promise.race([
      completeCheckout(deps, row(null, 'RUB', SessionType.INTRO_15), free),
      hung,
    ]);
    expect(res).toMatchObject({ status: BookingStatus.CONFIRMED });
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('эффекты упали — ответ тот же, ошибка в logger.error с номером брони', async () => {
    const onConfirmed = jest.fn(async () => {
      throw new Error('zoom down');
    });
    const { deps, logger } = confirmDeps(onConfirmed);
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const res = await completeCheckout(deps, row(70, 'EUR'), {
      ...OPTS,
      manual: true,
      heldUntil: null,
    });
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    await new Promise((r) => setImmediate(r));
    expect(error).toHaveBeenCalledWith(
      'Booking confirm effects failed, retry cron finishes: #5 zoom down',
    );
  });

  it('эффекты упали не Error-ом (undefined) — в логе всё равно номер брони', async () => {
    const onConfirmed = jest.fn().mockRejectedValue(undefined);
    const { deps, logger } = confirmDeps(onConfirmed);
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {});
    await completeCheckout(deps, row(70, 'EUR'), {
      ...OPTS,
      manual: true,
      heldUntil: null,
    });
    await new Promise((r) => setImmediate(r));
    expect(error).toHaveBeenCalledWith(
      'Booking confirm effects failed, retry cron finishes: #5 undefined',
    );
  });
});

// Ночной мутационный замер (stryker.golden-payments.config.json): e-mail для
// чека Robokassa и отказ оплаты в проде без кассы.
describe('completeCheckout — e-mail для чека и отказ без кассы', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['обычный адрес', 'anna@mail.ru', true],
    ['с пробелами вокруг', '  anna@mail.ru ', true],
    ['телефон', '+7 999 000-00-00', false],
    ['ник', '@anna', false],
    ['без точки в домене', 'anna@mail', false],
  ])('контакт «%s» → e-mail в счёт: %s', async (_n, contact, passed) => {
    const { deps, robokassa } = makeDeps();
    await completeCheckout(deps, row(4200), {
      ...OPTS,
      clientContact: contact,
    });
    const [args] = robokassa.buildPaymentUrl.mock.calls[0] as unknown as [
      { email?: string },
    ];
    expect(args.email).toBe(passed ? contact : undefined);
  });

  it('прод без кассы — 503 и error с видом платежа «booking»', async () => {
    const { deps, robokassa } = makeDeps();
    robokassa.enabled = false;
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      await expect(completeCheckout(deps, row(4200), OPTS)).rejects.toThrow(
        'PAYMENT_UNAVAILABLE',
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
    expect(error).toHaveBeenCalledWith(
      'Robokassa not configured in production: booking refused',
    );
  });
});
