// Вторая половина SubscriptionService, не покрытая subscription.payment.spec
// (тот файл — про идемпотентность webhook и защиту от двойного списания).
// Здесь: pricing, subscribe()/cancel()/статус-переходы, публичные геттеры,
// расхождение суммы webhook и failed-charge путь chargeDue (grace period,
// отключение после MAX_FAILS).
import {
  ServiceUnavailableException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  SubscriptionService,
  SUBSCRIPTION_INVID_BASE,
} from './subscription.service';
import { SUB_DEFAULT_PRICE } from '../booking/booking.config';

// Стейтфул-фейк Prisma: хранит подписки/списания в Map, чтобы find/update
// вели себя реалистично между вызовами внутри одного теста.
function makePrisma() {
  const subs = new Map<number, any>();
  const charges = new Map<number, any>();
  const settings = new Map<string, string>();
  let nextSubId = 1;
  let nextChargeId = 1;

  const prisma: any = {
    subs,
    charges,
    settings,
    bookingSetting: {
      findUnique: jest.fn(({ where: { key } }: any) =>
        settings.has(key) ? { key, value: settings.get(key) } : null,
      ),
      upsert: jest.fn(({ where: { key }, create, update }: any) => {
        settings.set(key, settings.has(key) ? update.value : create.value);
        return { key, value: settings.get(key) };
      }),
    },
    subscription: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextSubId++, failedAttempts: 0, ...data };
        subs.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn((args: any) => {
        const where = args.where;
        if (where.id !== undefined) return subs.get(where.id) ?? null;
        if (where.cancelToken !== undefined) {
          for (const s of subs.values())
            if (s.cancelToken === where.cancelToken) return s;
          return null;
        }
        return null;
      }),
      findFirst: jest.fn(({ where }: any) => {
        const candidates = [...subs.values()]
          .filter(
            (s) =>
              s.telegramId === where.telegramId &&
              where.status.in.includes(s.status),
          )
          .sort((a, b) => b.id - a.id);
        return candidates[0] ?? null;
      }),
      findMany: jest.fn(({ where }: any) =>
        [...subs.values()].filter(
          (s) =>
            where.status.in.includes(s.status) &&
            s.nextChargeAt != null &&
            s.nextChargeAt <= where.nextChargeAt.lte &&
            s.firstInvId != null,
        ),
      ),
      update: jest.fn(({ where: { id }, data }: any) => {
        const row = subs.get(id);
        Object.assign(row, data);
        return row;
      }),
    },
    subscriptionCharge: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextChargeId++, status: 'pending', ...data };
        charges.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(({ where: { id } }: any) => charges.get(id) ?? null),
      findFirst: jest.fn(() => null),
      updateMany: jest.fn(({ where, data }: any) => {
        const row = charges.get(where.id);
        if (!row || (where.status?.not && row.status === where.status.not))
          return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      update: jest.fn(({ where: { id }, data }: any) => {
        const row = charges.get(id);
        Object.assign(row, data);
        return row;
      }),
    },
    $transaction: jest.fn((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
    ),
  };
  return prisma;
}

function makeService(
  opts: {
    enabled?: boolean;
    robokassaEnabled?: boolean;
    chargeRecurringResult?: { ok: boolean; body: string };
  } = {},
) {
  const prisma = makePrisma();
  const calls = { alerts: [] as string[], recurring: [] as any[] };
  const robokassa = {
    enabled: opts.robokassaEnabled ?? true,
    buildPaymentUrl: jest.fn(
      (p: any) => `https://robokassa.test/pay?InvId=${p.invId}`,
    ),
    chargeRecurring: jest.fn((args: any) => {
      calls.recurring.push(args);
      return opts.chargeRecurringResult ?? { ok: true, body: '' };
    }),
  };
  const notify = {
    alertAdmin: jest.fn((msg: string) => {
      calls.alerts.push(msg);
    }),
  };
  const config = {
    get: (k: string) => {
      if (k === 'SUBSCRIPTION_ENABLED')
        return opts.enabled === false ? undefined : 'true';
      if (k === 'APP_URL') return 'https://schemehappens.ru';
      return undefined;
    },
  };
  const service = new SubscriptionService(
    prisma,
    robokassa as any,
    notify as any,
    config as any,
  );
  return { service, prisma, robokassa, notify, calls };
}

describe('SubscriptionService — pricing', () => {
  it('getPrice: возвращает дефолт, если в BookingSetting ничего нет', async () => {
    const { service } = makeService();
    expect(await service.getPrice('month')).toBe(SUB_DEFAULT_PRICE.month);
  });

  it('getPrice: возвращает дефолт при мусорном/нечисловом значении', async () => {
    const { service, prisma } = makeService();
    prisma.settings.set('sub:month', 'not-a-number');
    expect(await service.getPrice('month')).toBe(SUB_DEFAULT_PRICE.month);
  });

  it('setPrice → getPrice: сохранённая цена перекрывает дефолт, округляется и не уходит ниже 1', async () => {
    const { service } = makeService();
    await service.setPrice('year', 1234.6);
    expect(await service.getPrice('year')).toBe(1235);

    await service.setPrice('month', -50);
    expect(await service.getPrice('month')).toBe(1);
  });

  // Граница "n > 0" (не ">=0"): сохранённое значение "0" — мусор, должен
  // сработать дефолт, а не вернуться 0 как реальная цена.
  it('getPrice: значение "0" в BookingSetting трактуется как мусор → дефолт', async () => {
    const { service, prisma } = makeService();
    prisma.settings.set('sub:month', '0');
    expect(await service.getPrice('month')).toBe(SUB_DEFAULT_PRICE.month);
  });

  it('getOptions: обе опции с ценами', async () => {
    const { service } = makeService();
    const options = await service.getOptions();
    expect(options).toEqual([
      { period: 'month', price: SUB_DEFAULT_PRICE.month },
      { period: 'year', price: SUB_DEFAULT_PRICE.year },
    ]);
  });
});

describe('SubscriptionService — static helpers', () => {
  it('isSubscriptionInvId различает диапазон подписки', () => {
    expect(
      SubscriptionService.isSubscriptionInvId(SUBSCRIPTION_INVID_BASE),
    ).toBe(true);
    expect(
      SubscriptionService.isSubscriptionInvId(SUBSCRIPTION_INVID_BASE - 1),
    ).toBe(false);
  });

  it('isEnabled отражает SUBSCRIPTION_ENABLED из конфига', () => {
    expect(makeService({ enabled: true }).service.isEnabled()).toBe(true);
    expect(makeService({ enabled: false }).service.isEnabled()).toBe(false);
  });
});

describe('SubscriptionService.subscribe', () => {
  it('фича выключена → ServiceUnavailableException, ничего не создаётся', async () => {
    const { service, prisma } = makeService({ enabled: false });
    await expect(
      service.subscribe({ period: 'month', acceptedOffer: true }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('без согласия на автосписание → BadRequestException', async () => {
    const { service, prisma } = makeService();
    await expect(
      service.subscribe({ period: 'month', acceptedOffer: false }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('Robokassa выключена (dev) — подписка активируется сразу, paymentUrl=null', async () => {
    const { service, prisma } = makeService({ robokassaEnabled: false });
    const res = await service.subscribe({
      period: 'month',
      email: ' a@b.ru ',
      acceptedOffer: true,
    });
    expect(res.paymentUrl).toBeNull();
    expect(res.id).toBeDefined();
    const sub = prisma.subs.get(res.id);
    expect(sub.status).toBe('active');
    expect(sub.firstInvId).toBeDefined();
  });

  it('Robokassa включена — возвращает paymentUrl, подписка остаётся pending', async () => {
    const { service, prisma, robokassa } = makeService();
    const res = await service.subscribe({
      period: 'year',
      acceptedOffer: true,
    });
    expect(res.paymentUrl).toContain('robokassa.test');
    expect(robokassa.buildPaymentUrl).toHaveBeenCalledTimes(1);
    const sub = prisma.subs.get(res.id);
    expect(sub.status).toBe('pending');
    expect(sub.period).toBe('year');
  });

  it('period не "year" всегда трактуется как "month"', async () => {
    const { service, prisma } = makeService();
    const res = await service.subscribe({
      period: 'garbage' as any,
      acceptedOffer: true,
    });
    expect(prisma.subs.get(res.id).period).toBe('month');
  });

  it('email тримится перед сохранением (.trim() реально применяется)', async () => {
    const { service, prisma } = makeService({ robokassaEnabled: false });
    const res = await service.subscribe({
      period: 'month',
      email: '   a@b.ru   ',
      acceptedOffer: true,
    });
    expect(prisma.subs.get(res.id).email).toBe('a@b.ru');
  });

  it('email из пробелов превращается в null (не в пустую строку)', async () => {
    const { service, prisma } = makeService({ robokassaEnabled: false });
    const res = await service.subscribe({
      period: 'month',
      email: '   ',
      acceptedOffer: true,
    });
    expect(prisma.subs.get(res.id).email).toBeNull();
  });
});

describe('SubscriptionService.markChargePaidByInvId — расхождение суммы', () => {
  it('оплаченная сумма не совпадает с ожидаемой → алерт админу, но подписка всё равно активируется', async () => {
    const { service, prisma, calls } = makeService();
    const sub = await prisma.subscription.create({
      data: {
        status: 'pending',
        period: 'month',
        amount: 300,
        telegramId: null,
      },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: true },
    });
    await service.markChargePaidByInvId(
      SUBSCRIPTION_INVID_BASE + charge.id,
      999,
    );
    expect(calls.alerts.some((m) => m.includes('расходится'))).toBe(true);
    expect(prisma.subs.get(sub.id).status).toBe('active');
  });

  it('неизвестный InvId (charge не найден) → тихий no-op', async () => {
    const { service, calls } = makeService();
    const res = await service.markChargePaidByInvId(
      SUBSCRIPTION_INVID_BASE + 999999,
      100,
    );
    expect(res).toEqual({ ok: true });
    expect(calls.alerts.length).toBe(0);
  });

  it('subscription не найдена (осиротевший charge) → тихий no-op', async () => {
    const { service, prisma, calls } = makeService();
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: 999999, amount: 300, isFirst: true },
    });
    const res = await service.markChargePaidByInvId(
      SUBSCRIPTION_INVID_BASE + charge.id,
      300,
    );
    expect(res).toEqual({ ok: true });
    expect(calls.alerts.length).toBe(0);
  });

  it('charge уже paid → тихий no-op, subscription.update не вызывается', async () => {
    const { service, prisma, calls } = makeService();
    const sub = await prisma.subscription.create({
      data: { status: 'active', period: 'month', amount: 300 },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: {
        subscriptionId: sub.id,
        amount: 300,
        isFirst: true,
        status: 'paid',
      },
    });
    const res = await service.markChargePaidByInvId(
      SUBSCRIPTION_INVID_BASE + charge.id,
      300,
    );
    expect(res).toEqual({ ok: true });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(calls.alerts.length).toBe(0);
  });
});

describe('SubscriptionService.markChargePaidByInvId — расчёт следующего списания и firstInvId', () => {
  it('period=month: nextChargeAt сдвигается ровно на 1 месяц вперёд (не на 30 дней)', async () => {
    const { service, prisma } = makeService();
    const sub = await prisma.subscription.create({
      data: { status: 'pending', period: 'month', amount: 300 },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: true },
    });
    const before = Date.now();
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + charge.id);
    const row = prisma.subs.get(sub.id);
    const expected = new Date(before);
    expected.setUTCMonth(expected.getUTCMonth() + 1);
    // Сверяем месяц/год, а не миллисекунды — тест не гоняется на границе суток.
    expect(row.nextChargeAt.getUTCMonth()).toBe(expected.getUTCMonth());
    expect(row.nextChargeAt.getUTCFullYear()).toBe(expected.getUTCFullYear());
  });

  it('period=year: nextChargeAt сдвигается ровно на 1 год (не на 12 месяцев неверно вычисленных)', async () => {
    const { service, prisma } = makeService();
    const sub = await prisma.subscription.create({
      data: { status: 'pending', period: 'year', amount: 3000 },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 3000, isFirst: true },
    });
    const before = new Date();
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + charge.id);
    const row = prisma.subs.get(sub.id);
    expect(row.nextChargeAt.getUTCFullYear()).toBe(before.getUTCFullYear() + 1);
  });

  it('продление (isFirst=false) НЕ перезаписывает firstInvId уже активной подписки', async () => {
    const { service, prisma, calls } = makeService();
    const sub = await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        firstInvId: 900001,
      },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: false },
    });
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + charge.id);
    expect(prisma.subs.get(sub.id).firstInvId).toBe(900001);
    expect(calls.alerts.some((m) => m.includes('Продление'))).toBe(true);
    expect(calls.alerts.some((m) => m.includes('Новая подписка'))).toBe(false);
  });

  it('первая оплата (isFirst=true) записывает firstInvId и шлёт алерт "Новая подписка"', async () => {
    const { service, prisma, calls } = makeService();
    const sub = await prisma.subscription.create({
      data: { status: 'pending', period: 'month', amount: 300 },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: true },
    });
    const invId = SUBSCRIPTION_INVID_BASE + charge.id;
    await service.markChargePaidByInvId(invId);
    expect(prisma.subs.get(sub.id).firstInvId).toBe(invId);
    expect(calls.alerts.some((m) => m.includes('Новая подписка'))).toBe(true);
  });
});

describe('SubscriptionService.cancel', () => {
  it('несуществующий токен → NotFoundException', async () => {
    const { service } = makeService();
    await expect(service.cancel('no-such-token')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('активная подписка отменяется, nextChargeAt сбрасывается', async () => {
    const { service, prisma } = makeService();
    const sub = await prisma.subscription.create({
      data: {
        status: 'active',
        cancelToken: 'tok-1',
        period: 'month',
        amount: 300,
        nextChargeAt: new Date(),
      },
    });
    await service.cancel('tok-1');
    const row = prisma.subs.get(sub.id);
    expect(row.status).toBe('cancelled');
    expect(row.nextChargeAt).toBeNull();
  });

  it('идемпотентна: повторная отмена уже отменённой не бьёт по БД update повторно', async () => {
    const { service, prisma } = makeService();
    await prisma.subscription.create({
      data: {
        status: 'cancelled',
        cancelToken: 'tok-2',
        period: 'month',
        amount: 300,
      },
    });
    await service.cancel('tok-2');
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cancelToken: 'tok-2' } }),
    );
  });
});

describe('SubscriptionService.getPublicByToken', () => {
  it('несуществующий токен → NotFoundException', async () => {
    const { service } = makeService();
    await expect(service.getPublicByToken('nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('возвращает статус/период/цену без PII (без email/telegramId)', async () => {
    const { service, prisma } = makeService();
    await prisma.subscription.create({
      data: {
        status: 'active',
        cancelToken: 'tok-3',
        period: 'year',
        amount: 5000,
        email: 'secret@mail.ru',
        nextChargeAt: new Date('2027-01-01T00:00:00Z'),
      },
    });
    const view = await service.getPublicByToken('tok-3');
    expect(view).toEqual({
      status: 'active',
      period: 'year',
      amount: 5000,
      nextChargeAt: '2027-01-01T00:00:00.000Z',
    });
    expect(view).not.toHaveProperty('email');
  });

  it('nextChargeAt=null сериализуется в null, а не кидает', async () => {
    const { service, prisma } = makeService();
    await prisma.subscription.create({
      data: {
        status: 'cancelled',
        cancelToken: 'tok-4',
        period: 'month',
        amount: 300,
        nextChargeAt: null,
      },
    });
    const view = await service.getPublicByToken('tok-4');
    expect(view.nextChargeAt).toBeNull();
  });
});

describe('SubscriptionService.findActiveByTelegram', () => {
  it('нет подписок у юзера → null', async () => {
    const { service } = makeService();
    expect(await service.findActiveByTelegram(123n)).toBeNull();
  });

  it('находит активную/past_due, игнорирует cancelled', async () => {
    const { service, prisma } = makeService();
    await prisma.subscription.create({
      data: {
        status: 'cancelled',
        telegramId: 42n,
        period: 'month',
        amount: 300,
      },
    });
    const active = await prisma.subscription.create({
      data: {
        status: 'past_due',
        telegramId: 42n,
        period: 'month',
        amount: 300,
        cancelToken: 'tok-5',
        nextChargeAt: null,
      },
    });
    const res = await service.findActiveByTelegram(42n);
    expect(res?.id).toBe(active.id);
    expect(res?.status).toBe('past_due');
    expect(res?.cancelToken).toBe('tok-5');
  });
});

describe('SubscriptionService.chargeDue — выключенные флаги', () => {
  // Осознанный weak (оба теста): chargeDue() возвращает void сразу на гварде —
  // единственный наблюдаемый эффект early-return'а — отсутствие DB-вызова.
  it('SUBSCRIPTION_ENABLED=false → выходит немедленно, БД не трогает', async () => {
    const { service, prisma } = makeService({ enabled: false });
    await service.chargeDue();
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
  });

  it('Robokassa выключена → выходит немедленно', async () => {
    const { service, prisma } = makeService({ robokassaEnabled: false });
    await service.chargeDue();
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
  });
});

describe('SubscriptionService.chargeDue — неудачное списание (grace period)', () => {
  function makeDueSub(
    prisma: ReturnType<typeof makePrisma>,
    failedAttempts = 0,
  ) {
    return prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        telegramId: null,
        firstInvId: 900001,
        failedAttempts,
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
  }

  it('первый неудачный чардж (< MAX_FAILS): статус не трогаем, ретрай через сутки', async () => {
    const { service, prisma, calls } = makeService({
      chargeRecurringResult: { ok: false, body: 'insufficient funds' },
    });
    const sub = await makeDueSub(prisma, 0);
    await service.chargeDue();
    const row = prisma.subs.get(sub.id);
    expect(row.status).toBe('active'); // ещё не past_due
    expect(row.failedAttempts).toBe(1);
    expect(row.nextChargeAt).toBeInstanceOf(Date);
    expect(row.nextChargeAt.getTime()).toBeGreaterThan(Date.now());
    expect(calls.alerts.some((m) => m.includes('Не удалось списать'))).toBe(
      true,
    );
  });

  it('MAX_FAILS достигнут → past_due, nextChargeAt=null (больше не ретраим автоматически)', async () => {
    const { service, prisma } = makeService({
      chargeRecurringResult: { ok: false, body: 'card expired' },
    });
    const sub = await makeDueSub(prisma, 2); // 2 → станет 3 = MAX_FAILS
    await service.chargeDue();
    const row = prisma.subs.get(sub.id);
    expect(row.status).toBe('past_due');
    expect(row.failedAttempts).toBe(3);
    expect(row.nextChargeAt).toBeNull();
  });

  it('charge помечается failed в БД (не остаётся pending)', async () => {
    const { service, prisma } = makeService({
      chargeRecurringResult: { ok: false, body: 'boom' },
    });
    await makeDueSub(prisma, 0);
    await service.chargeDue();
    const charges = [...prisma.charges.values()];
    expect(charges.some((c) => c.status === 'failed')).toBe(true);
  });
});

describe('SubscriptionService.chargeDue — успешное списание', () => {
  it('res.ok=true → nextChargeAt сдвигается на период вперёд, failedAttempts не трогается, статус active', async () => {
    const { service, prisma, robokassa } = makeService();
    const sub = await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        telegramId: null,
        firstInvId: 900001,
        failedAttempts: 1, // не должен обнулиться здесь — сброс идёт в markChargePaid по вебхуку
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
    const before = Date.now();
    await service.chargeDue();
    expect(robokassa.chargeRecurring).toHaveBeenCalledWith(
      expect.objectContaining({
        previousInvId: 900001,
        amount: 300,
      }),
    );
    const row = prisma.subs.get(sub.id);
    expect(row.status).toBe('active');
    expect(row.failedAttempts).toBe(1);
    const expectedMonth = new Date(before);
    expectedMonth.setUTCMonth(expectedMonth.getUTCMonth() + 1);
    expect(row.nextChargeAt.getUTCMonth()).toBe(expectedMonth.getUTCMonth());
    // Списание успешно отправлено, но НЕ подтверждено — charge остаётся pending,
    // подтверждает его только webhook (markChargePaid).
    const charges = [...prisma.charges.values()];
    expect(charges.some((c) => c.status === 'pending')).toBe(true);
  });

  it('подписка без firstInvId (ещё не активирована первым платежом) НЕ попадает в выборку due и не списывается', async () => {
    const { service, prisma, robokassa } = makeService();
    const sub = await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        firstInvId: null,
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
    await service.chargeDue();
    expect(robokassa.chargeRecurring).not.toHaveBeenCalled();
    // Подписка не тронута этим тиком (не сдвинулась дальше pending-состояния).
    expect(prisma.subs.get(sub.id).nextChargeAt).toEqual(sub.nextChargeAt);
  });
});
