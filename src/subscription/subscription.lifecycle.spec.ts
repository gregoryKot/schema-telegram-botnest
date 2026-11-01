// Вторая половина SubscriptionService, не покрытая subscription.payment.spec
// (тот файл — про идемпотентность webhook и защиту от двойного списания).
// Здесь: pricing, subscribe()/cancel()/статус-переходы, публичные геттеры,
// расхождение суммы webhook и failed-charge путь chargeDue (grace period,
// отключение после MAX_FAILS).
import {
  Logger,
  ServiceUnavailableException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  SubscriptionService,
  SUBSCRIPTION_INVID_BASE,
} from './subscription.service';
import { SUB_DEFAULT_PRICE } from '../booking/booking.config';
import { subscriptionUpdateMany } from '../test-support/subscription-update-many';

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
      updateMany: subscriptionUpdateMany(subs),
    },
    // Атомарный захват подписки перед списанием: UPDATE "Subscription"
    // SET nextChargeAt = $1 WHERE id = $2 AND nextChargeAt <= $3. Дублёр
    // применяет его к стейту так же, как Postgres — иначе тест «строка после
    // списания» проверял бы не то состояние, которое будет в проде.
    // Возвращает число обновлённых строк: 0 = подписку уже забрал другой
    // обработчик.
    // $executeRaw — тег-функция: значения приходят отдельными аргументами
    // после шаблона, а не полем .values.
    $executeRaw: jest.fn(
      async (_sql: TemplateStringsArray, ...values: unknown[]) => {
        const [nextAt, id, notAfter] = values as [Date, number, Date];
        const row = subs.get(id);
        if (!row?.nextChargeAt || row.nextChargeAt > notAfter) return 0;
        row.nextChargeAt = nextAt;
        return 1;
      },
    ),
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
    notifyAdminBoth: jest.fn(async (_html: string, _subject: string) => {}),
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
    { claimRun: jest.fn().mockResolvedValue(true) } as any, // аренда крона — своя
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

  // Раньше getPrice читал строку через parseInt: '1e+22' становился 1 ₽,
  // '12abc' — 12 ₽. Теперь — строгий разбор (whole-price.ts), мусор → дефолт.
  it('getPrice: экспонента, дробь, хвост, минус и сверх потолка — дефолт, не цена', async () => {
    const { service, prisma } = makeService();
    for (const raw of ['1e+22', '1e3', '499.9', '12abc', '-5', '1000001', '']) {
      prisma.settings.set('sub:month', raw);
      expect([raw, await service.getPrice('month')]).toEqual([
        raw,
        SUB_DEFAULT_PRICE.month,
      ]);
    }
    prisma.settings.set('sub:month', ' 700 ');
    expect(await service.getPrice('month')).toBe(700);
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

  describe('прод без Robokassa (аудит 2026-10-11)', () => {
    const was = process.env.NODE_ENV;
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });
    afterEach(() => {
      process.env.NODE_ENV = was;
      jest.restoreAllMocks();
    });

    it('отказ 503 до INSERT: подписка не создаётся и не включается бесплатно', async () => {
      const { service, prisma } = makeService({ robokassaEnabled: false });
      await expect(
        service.subscribe({ period: 'month', acceptedOffer: true }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.subscription.create).not.toHaveBeenCalled();
      expect(prisma.subs.size).toBe(0);
      expect(prisma.charges.size).toBe(0);
    });

    it('контроль: с настроенной Robokassa в проде подписка идёт на оплату', async () => {
      const { service, prisma } = makeService();
      const res = await service.subscribe({
        period: 'month',
        acceptedOffer: true,
      });
      expect(res.paymentUrl).toContain('robokassa.test');
      expect(prisma.subs.get(res.id).status).toBe('pending');
    });
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

  it('charge уже paid → тихий no-op, подписка не трогается', async () => {
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
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
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

  // Аудит 2026-10-11 (booking-cas): update по id без предиката статуса затирал
  // бы переход, сделанный между findUnique и записью (cancelled — финал).
  it('запись отмены несёт предикат статуса: уже cancelled строку не трогает', async () => {
    const { service, prisma } = makeService();
    const sub = await prisma.subscription.create({
      data: {
        status: 'active',
        cancelToken: 'tok-3',
        period: 'month',
        amount: 300,
      },
    });
    await service.cancel('tok-3');
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: sub.id, status: { not: 'cancelled' } },
      data: { status: 'cancelled', nextChargeAt: null },
    });
    // Фейк считает count как Postgres: вторая запись по тому же предикату — 0 строк.
    const again = await prisma.subscription.updateMany({
      where: { id: sub.id, status: { not: 'cancelled' } },
      data: { status: 'cancelled', nextChargeAt: null },
    });
    expect(again).toEqual({ count: 0 });
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
    prisma.subscription.updateMany.mockClear();
    await service.cancel('tok-2');
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
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

  // Вебхук оплаты пришёл, пока chargeRecurring возвращал сбой: charge уже paid,
  // nextChargeAt выставил вебхук. Сбой не засчитывается и ретрай через сутки не
  // ставится — иначе второе реальное списание за оплаченный период.
  it('вебхук оплатил charge раньше сбоя: подписка не тронута, алерта нет', async () => {
    const { service, prisma, robokassa, calls } = makeService();
    const paidUntil = new Date(Date.now() + 30 * 24 * 3_600_000);
    robokassa.chargeRecurring.mockImplementation(() => {
      const [charge] = [...prisma.charges.values()];
      charge.status = 'paid';
      prisma.subs.get(1).nextChargeAt = paidUntil;
      return { ok: false, body: 'timeout' };
    });
    const sub = await makeDueSub(prisma, 0);
    await service.chargeDue();
    const row = prisma.subs.get(sub.id);
    expect(row.failedAttempts).toBe(0);
    expect(row.nextChargeAt).toBe(paidUntil);
    expect([...prisma.charges.values()][0].status).toBe('paid');
    expect(calls.alerts).toHaveLength(0);
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

// Аудит 2026-10, security#17: оплата после отмены не воскрешает подписку.
// Деньги засчитаны за charge, владельцу уходит сигнал в оба канала.
describe('SubscriptionService — оплата и сбой списания после отмены', () => {
  async function seed(
    prisma: ReturnType<typeof makePrisma>,
    status: string,
    over: Record<string, unknown> = {},
    isFirst = false,
  ) {
    const sub = await prisma.subscription.create({
      data: {
        status,
        cancelToken: 'tok-late',
        period: 'month',
        amount: 300,
        telegramId: 777n,
        email: 'late@example.com',
        firstInvId: 900001,
        nextChargeAt: new Date(Date.now() + 86_400_000),
        ...over,
      },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst },
    });
    return { sub, charge, invId: SUBSCRIPTION_INVID_BASE + charge.id };
  }

  it('active + pending-charge → cancel → вебхук: charge paid, подписка cancelled, сигнал один раз', async () => {
    const { service, prisma, notify, calls } = makeService();
    const { sub, charge, invId } = await seed(prisma, 'active');
    await service.cancel('tok-late');

    const res = await service.markChargePaidByInvId(invId, 300);

    expect(res).toEqual({ ok: true });
    expect(prisma.charges.get(charge.id).status).toBe('paid');
    const row = prisma.subs.get(sub.id);
    expect(row.status).toBe('cancelled');
    expect(row.nextChargeAt).toBeNull();
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
    const [html, subject] = notify.notifyAdminBoth.mock.calls[0];
    expect(html).toContain(`#${sub.id}`);
    expect(html).toContain('Верните деньги');
    expect(subject).not.toMatch(/<|💸/);
    expect(calls.alerts.join('')).not.toContain('Продление');

    // Повтор вебхука: тишина, второго сигнала нет.
    await service.markChargePaidByInvId(invId, 300);
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
  });

  it('pending (первый charge) → cancel → оплата по старой ссылке: подписка cancelled, firstInvId не пишется', async () => {
    const { service, prisma, notify } = makeService();
    const { sub, invId } = await seed(
      prisma,
      'pending',
      { firstInvId: null, nextChargeAt: null },
      true,
    );
    await service.cancel('tok-late');

    await service.markChargePaidByInvId(invId, 300);

    const row = prisma.subs.get(sub.id);
    expect(row.status).toBe('cancelled');
    expect(row.firstInvId).toBeNull();
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
  });

  it('chargeDue: отмена во время запроса в Robokassa, отказ → подписка остаётся cancelled без повторного списания', async () => {
    const { service, prisma, robokassa } = makeService();
    const { sub } = await seed(prisma, 'active', {
      nextChargeAt: new Date(Date.now() - 1000),
    });
    robokassa.chargeRecurring.mockImplementation(async () => {
      await service.cancel('tok-late');
      return { ok: false, body: 'declined' };
    });
    // Для этой подписки выше засеян pending-charge: чистим, чтобы дошло до списания.
    prisma.charges.clear();

    await service.chargeDue();

    const row = prisma.subs.get(sub.id);
    expect(row.status).toBe('cancelled');
    expect(row.nextChargeAt).toBeNull();
  });

  it('chargeDue: то же на пороге MAX_FAILS — не past_due', async () => {
    const { service, prisma, robokassa } = makeService();
    const { sub } = await seed(prisma, 'active', {
      failedAttempts: 2,
      nextChargeAt: new Date(Date.now() - 1000),
    });
    robokassa.chargeRecurring.mockImplementation(async () => {
      await service.cancel('tok-late');
      return { ok: false, body: 'declined' };
    });
    prisma.charges.clear();

    await service.chargeDue();

    const row = prisma.subs.get(sub.id);
    expect(row.status).toBe('cancelled');
    expect(row.failedAttempts).toBe(2);
  });

  it('атомарность: падение записи подписки откатывает charge, ретрай вебхука довершает активацию', async () => {
    const { service, prisma } = makeService();
    const { sub, charge, invId } = await seed(
      prisma,
      'pending',
      { firstInvId: null, nextChargeAt: null },
      true,
    );
    // Откат как в Postgres: интерактивная транзакция вернёт charge в pending.
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const snapshot = { ...prisma.charges.get(charge.id) };
      try {
        return await fn(prisma);
      } catch (e) {
        prisma.charges.set(charge.id, snapshot);
        throw e;
      }
    });
    prisma.subscription.updateMany.mockImplementationOnce(() => {
      throw new Error('db down');
    });

    await expect(service.markChargePaidByInvId(invId, 300)).rejects.toThrow(
      'db down',
    );
    expect(prisma.charges.get(charge.id).status).toBe('pending');

    await service.markChargePaidByInvId(invId, 300);
    expect(prisma.charges.get(charge.id).status).toBe('paid');
    expect(prisma.subs.get(sub.id).status).toBe('active');
    expect(prisma.subs.get(sub.id).firstInvId).toBe(invId);
  });

  it('КОНТРОЛЬ: past_due + поздний платёж → active, счётчик сбоев обнулён, сигнала нет', async () => {
    const { service, prisma, notify } = makeService();
    const { sub, invId } = await seed(prisma, 'past_due', {
      failedAttempts: 3,
      nextChargeAt: null,
    });

    await service.markChargePaidByInvId(invId, 300);

    const row = prisma.subs.get(sub.id);
    expect(row.status).toBe('active');
    expect(row.failedAttempts).toBe(0);
    expect(row.nextChargeAt).toBeInstanceOf(Date);
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });

  it('КОНТРОЛЬ: обычное продление active → active, алерт «Продление»', async () => {
    const { service, prisma, notify, calls } = makeService();
    const { sub, invId } = await seed(prisma, 'active');

    await service.markChargePaidByInvId(invId, 300);

    expect(prisma.subs.get(sub.id).status).toBe('active');
    expect(calls.alerts.join('')).toContain('Продление');
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });
});
