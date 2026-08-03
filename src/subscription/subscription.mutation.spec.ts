// Точечное усиление subscription.service.ts против выживших мутантов
// (Stryker waveB, reports/mutation/waveB.json). В отличие от
// subscription.lifecycle.spec.ts / subscription.payment.spec.ts, здесь
// проверяются РЕЗУЛЬТАТЫ (полные объекты-аргументы, реальные значения в БД),
// а не факт вызова — иначе Stryker ломает строку, а тест остаётся зелёным.
// Этот файл: subscribe() (полный объект payment-URL) + priceKey. Продолжение
// (CAS/алерты/chargeDue) — subscription.mutation2.spec.ts (лимит ~300 строк/файл).
import {
  SubscriptionService,
  SUBSCRIPTION_INVID_BASE,
} from './subscription.service';

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
    appUrl?: string | undefined;
  } = {},
) {
  const prisma = makePrisma();
  const robokassa = {
    enabled: opts.robokassaEnabled ?? true,
    buildPaymentUrl: jest.fn(
      (p: any) => `https://robokassa.test/pay?InvId=${p.invId}`,
    ),
    chargeRecurring: jest.fn(),
  };
  const notify = { alertAdmin: jest.fn() };
  const config = {
    get: (k: string) => {
      if (k === 'SUBSCRIPTION_ENABLED')
        return opts.enabled === false ? undefined : 'true';
      if (k === 'APP_URL') return opts.appUrl;
      return undefined;
    },
  };
  const service = new SubscriptionService(
    prisma,
    robokassa as any,
    notify as any,
    config as any,
  );
  return { service, prisma, robokassa, notify };
}

describe('SubscriptionService.subscribe — полный объект платёжного запроса', () => {
  it('period=year, email задан: invId/amount/desc/urls/recurring — все поля верны одновременно', async () => {
    const { service, prisma, robokassa } = makeService();
    const res = await service.subscribe({
      period: 'year',
      email: 'a@b.ru',
      acceptedOffer: true,
    });
    const charge = [...prisma.charges.values()][0];
    expect(robokassa.buildPaymentUrl).toHaveBeenCalledWith({
      invId: SUBSCRIPTION_INVID_BASE + charge.id, // не "-" (ArithmeticOperator)
      amount: 5000,
      desc: 'Подписка SchemeHappens (год)',
      email: 'a@b.ru',
      successUrl: `https://schemehappens.ru/subscribe?sub=ok&token=${res.cancelToken}`,
      failUrl: `https://schemehappens.ru/subscribe?sub=fail`,
      recurring: true, // не false — иначе карта не токенизируется
    });
  });

  it('period=month → desc содержит "месяц", а не "год" (EqualityOperator на тернарнике)', async () => {
    const { service, robokassa } = makeService();
    await service.subscribe({ period: 'month', acceptedOffer: true });
    const args = robokassa.buildPaymentUrl.mock.calls[0][0];
    expect(args.desc).toBe('Подписка SchemeHappens (месяц)');
  });

  it('email не передан → в объекте email===undefined, а не пустая строка/null (LogicalOperator/ConditionalExpression)', async () => {
    const { service, robokassa } = makeService();
    await service.subscribe({ period: 'month', acceptedOffer: true });
    const args = robokassa.buildPaymentUrl.mock.calls[0][0];
    expect(args.email).toBeUndefined();
  });

  it('email из одних пробелов → тоже undefined (не пустая строка после trim)', async () => {
    const { service, robokassa } = makeService();
    await service.subscribe({
      period: 'month',
      email: '   ',
      acceptedOffer: true,
    });
    expect(robokassa.buildPaymentUrl.mock.calls[0][0].email).toBeUndefined();
  });

  it('APP_URL не задан в конфиге → successUrl падает на дефолтный домен schemehappens.ru (StringLiteral-дефолты)', async () => {
    const { service, robokassa } = makeService({ appUrl: undefined });
    await service.subscribe({ period: 'month', acceptedOffer: true });
    const args = robokassa.buildPaymentUrl.mock.calls[0][0];
    expect(args.successUrl).toContain('https://schemehappens.ru/subscribe');
  });

  it('telegramId сохраняется как передан, а не превращается в null (LogicalOperator ?? → &&)', async () => {
    const { service, prisma } = makeService();
    const res = await service.subscribe({
      period: 'month',
      telegramId: 777n,
      acceptedOffer: true,
    });
    expect(prisma.subs.get(res.id).telegramId).toBe(777n);
  });

  it('второй charge.id (>1) в объекте — invId растёт вместе с id, не "минусуется" (регресс на ArithmeticOperator)', async () => {
    const { service, robokassa } = makeService();
    await service.subscribe({ period: 'month', acceptedOffer: true }); // charge #1
    await service.subscribe({ period: 'month', acceptedOffer: true }); // charge #2
    const secondArgs = robokassa.buildPaymentUrl.mock.calls[1][0];
    expect(secondArgs.invId).toBe(SUBSCRIPTION_INVID_BASE + 2);
  });
});

describe('SubscriptionService — priceKey (денормализованный ключ настройки)', () => {
  it('setPrice(month) реально пишет под ключом "sub:month", а не под общим/пустым ключом', async () => {
    const { service, prisma } = makeService();
    await service.setPrice('month', 700);
    expect(prisma.settings.has('sub:month')).toBe(true);
    expect(prisma.settings.get('sub:month')).toBe('700');
  });

  it('setPrice(year) пишет отдельно от "sub:month" (ключи не схлопываются в один)', async () => {
    const { service, prisma } = makeService();
    await service.setPrice('month', 100);
    await service.setPrice('year', 900);
    expect(prisma.settings.get('sub:month')).toBe('100');
    expect(prisma.settings.get('sub:year')).toBe('900');
  });

  it('повторный setPrice для уже существующего ключа реально ОБНОВЛЯЕТ значение (ветка update upsert)', async () => {
    const { service } = makeService();
    await service.setPrice('month', 100);
    await service.setPrice('month', 250); // второй вызов идёт по ветке update, не create
    expect(await service.getPrice('month')).toBe(250);
  });
});

describe('SubscriptionService.cancel / getPublicByToken — сообщения ошибок', () => {
  it('cancel: несуществующий токен бросает ИМЕННО "Subscription not found"', async () => {
    const { service } = makeService();
    await expect(service.cancel('nope')).rejects.toThrow(
      'Subscription not found',
    );
  });

  it('getPublicByToken: несуществующий токен бросает ИМЕННО "Subscription not found"', async () => {
    const { service } = makeService();
    await expect(service.getPublicByToken('nope')).rejects.toThrow(
      'Subscription not found',
    );
  });
});
