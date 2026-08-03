// Продолжение subscription.mutation2/3.spec.ts (лимит ~300 строк/файл).
// Закрывает остаток выживших мутантов из reports/mutation/check.json:
//   - APP_URL реально читается по СВОЕМУ ключу конфига (не подставляется
//     дефолт для любого другого ключа) — StringLiteral 'APP_URL' → "".
//   - subscribe(): точные тексты ошибок SUBSCRIPTION_DISABLED/OFFER_NOT_ACCEPTED
//     (сейчас проверялся только класс исключения — пустая строка тоже кинула бы
//     нужный класс, StringLiteral выживал).
//   - cancel(): реальный возврат {ok:true} (BooleanLiteral/ObjectLiteral) —
//     раньше проверялось только состояние в БД, не то, что метод отдаёт вызывающему.
//   - chargeDue(): текст алерта о зависшем pending-charge содержит id брони и
//     подписки (StringLiteral на шаблон целиком).
import {
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

function makePrisma() {
  const subs = new Map<number, any>();
  const charges = new Map<number, any>();
  let nextSubId = 1;
  let nextChargeId = 1;

  const prisma: any = {
    subs,
    charges,
    bookingSetting: { findUnique: jest.fn(() => null) },
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
      findFirst: jest.fn(() => null),
    },
    $transaction: jest.fn((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
    ),
  };
  return prisma;
}

function makeService(
  opts: { enabled?: boolean; appUrl?: string; robokassaEnabled?: boolean } = {},
) {
  const prisma = makePrisma();
  const calls = { alerts: [] as string[] };
  const robokassa = {
    enabled: opts.robokassaEnabled ?? true,
    buildPaymentUrl: jest.fn(
      (p: any) => `https://robokassa.test/pay?InvId=${p.invId}`,
    ),
    chargeRecurring: jest.fn(() => ({ ok: true, body: '' })),
  };
  const notify = {
    alertAdmin: jest.fn((msg: string) => {
      calls.alerts.push(msg);
    }),
  };
  const config = {
    // Ключи различаются нарочно: мутант, подменивший 'APP_URL' на "",
    // получит undefined и уедет на дефолтный домен вместо custom-appUrl.
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
  return { service, prisma, robokassa, calls };
}

describe('SubscriptionService — appUrl читается СТРОГО по ключу APP_URL', () => {
  it('config.get вызван по конкретному ключу APP_URL — заданное значение реально уходит в successUrl', async () => {
    const { service, robokassa } = makeService({
      appUrl: 'https://custom.example.ru',
    });
    await service.subscribe({ period: 'month', acceptedOffer: true });
    const args = robokassa.buildPaymentUrl.mock.calls[0][0];
    // Если бы StringLiteral 'APP_URL' подменился на "", config.get("") дал бы
    // undefined и appUrl съехал бы на дефолт schemehappens.ru, а не custom.example.ru.
    expect(args.successUrl).toContain('https://custom.example.ru/subscribe');
    expect(args.successUrl).not.toContain('schemehappens.ru');
  });
});

describe('SubscriptionService.subscribe — точные тексты ошибок (не просто класс)', () => {
  it('фича выключена → сообщение ИМЕННО "SUBSCRIPTION_DISABLED"', async () => {
    const { service } = makeService({ enabled: false });
    await expect(
      service.subscribe({ period: 'month', acceptedOffer: true }),
    ).rejects.toThrow(
      expect.objectContaining({
        message: 'SUBSCRIPTION_DISABLED',
      }),
    );
    await expect(
      service.subscribe({ period: 'month', acceptedOffer: true }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('нет согласия на автосписание → сообщение ИМЕННО "OFFER_NOT_ACCEPTED"', async () => {
    const { service } = makeService();
    await expect(
      service.subscribe({ period: 'month', acceptedOffer: false }),
    ).rejects.toThrow(
      expect.objectContaining({ message: 'OFFER_NOT_ACCEPTED' }),
    );
    await expect(
      service.subscribe({ period: 'month', acceptedOffer: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SubscriptionService.cancel — реальный возврат {ok:true}', () => {
  it('успешная отмена отдаёт вызывающему ровно {ok:true} (не {} и не false)', async () => {
    const { service, prisma } = makeService();
    await prisma.subscription.create({
      data: {
        status: 'active',
        cancelToken: 'tok-ret',
        period: 'month',
        amount: 300,
      },
    });
    await expect(service.cancel('tok-ret')).resolves.toEqual({ ok: true });
  });

  it('повторная отмена (уже cancelled) тоже отдаёт ровно {ok:true}', async () => {
    const { service, prisma } = makeService();
    await prisma.subscription.create({
      data: {
        status: 'cancelled',
        cancelToken: 'tok-done',
        period: 'month',
        amount: 300,
      },
    });
    await expect(service.cancel('tok-done')).resolves.toEqual({ ok: true });
  });
});

describe('SubscriptionService.chargeDue — desc рекуррентного списания для periode=month', () => {
  // subscription.mutation3.spec.ts проверяет только period=year ('год') для
  // chargeRecurring.desc — EqualityOperator (period==='year' → !==='year') и
  // ветка StringLiteral 'месяц' для чарджей на продление ЕЩЁ НЕ проверены:
  // это ОТДЕЛЬНЫЙ тернарник (chargeDue, строка ~289), не тот же, что в subscribe().
  it('period=month → chargeRecurring.desc содержит "месяц", а не "год"', async () => {
    const { service, prisma, robokassa } = makeService();
    await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        firstInvId: 900001,
        failedAttempts: 0,
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
    await service.chargeDue();
    expect(robokassa.chargeRecurring.mock.calls[0][0].desc).toBe(
      'Подписка SchemeHappens (месяц)',
    );
  });
});

describe('SubscriptionService.chargeDue — текст алерта о зависшем pending-charge', () => {
  it('алерт называет номер подписки и номер зависшего charge (не пустая строка)', async () => {
    const { service, prisma, calls } = makeService();
    const sub = await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        firstInvId: 900001,
        failedAttempts: 0,
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
    prisma.subscriptionCharge.findFirst = jest.fn(() => ({
      id: 321,
      status: 'pending',
      createdAt: new Date(),
    }));
    await service.chargeDue();
    const alert = calls.alerts[calls.alerts.length - 1];
    expect(alert).toContain(`Подписка #${sub.id}`);
    expect(alert).toContain('pending-charge #321');
  });
});
