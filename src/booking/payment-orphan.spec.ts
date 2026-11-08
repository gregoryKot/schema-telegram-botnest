// Аудит 2026-11, R9: вебхук Robokassa с верной подписью по донату или
// подписке, для которых в БД нет строки, подтверждался ответом OK молча —
// деньги списаны, а владелец не узнавал. Ответ остаётся OK (повтор строку не
// создаст), но владельцу уходит error() со стабильным текстом: AlertLogger
// шлёт его в DM с троттлингом (src/logger/alert-gate.ts).
import { Logger } from '@nestjs/common';
import {
  DonationService,
  DONATION_INVID_BASE,
} from '../donation/donation.service';
import { markChargePaid } from '../subscription/subscription.charges';
import { SUBSCRIPTION_INVID_BASE } from '../subscription/subscription.constants';

afterEach(() => jest.restoreAllMocks());

describe('DonationService.markPaidByInvId — строки доната нет', () => {
  it('OK для Robokassa, владельцу — error() про оплату без строки, БД не пишется', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const prisma = {
      donation: {
        findUnique: jest.fn(async () => null),
        updateMany: jest.fn(),
      },
    };
    const service = new DonationService(
      prisma as never,
      { enabled: true } as never,
      { alertAdmin: jest.fn() } as never,
      { get: () => undefined } as never,
    );
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 77, 500),
    ).resolves.toEqual({ ok: true });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toMatch(
      /оплата доната #77 \(500 ₽\) без строки в БД/,
    );
    expect(prisma.donation.updateMany).not.toHaveBeenCalled();
  });
});

describe('markChargePaid — строки списания или подписки нет', () => {
  function deps(charge: unknown, sub: unknown) {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const prisma = {
      subscriptionCharge: { findUnique: jest.fn(async () => charge) },
      subscription: { findUnique: jest.fn(async () => sub) },
      $transaction: jest.fn(),
    };
    const notify = { alertAdmin: jest.fn() };
    return {
      logger,
      prisma,
      notify,
      d: {
        prisma: prisma as never,
        robokassa: {} as never,
        notify: notify as never,
        logger: logger as unknown as Logger,
        enabled: true,
      },
    };
  }

  it('нет charge → OK и error() с InvId и суммой', async () => {
    const { d, logger, prisma } = deps(null, null);
    const invId = SUBSCRIPTION_INVID_BASE + 9;
    await expect(markChargePaid(d, invId, 500)).resolves.toEqual({ ok: true });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`InvId ${invId} \\(500 ₽\\), без строки списания в БД`),
      ),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('charge есть, подписки нет → OK и error() про подписку', async () => {
    const charge = { id: 9, subscriptionId: 3, status: 'pending', amount: 500 };
    const { d, logger, prisma } = deps(charge, null);
    await markChargePaid(d, SUBSCRIPTION_INVID_BASE + 9, 500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('без строки подписки'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('КОНТРОЛЬ: charge уже paid (повтор вебхука) — тихий OK без алерта', async () => {
    const charge = { id: 9, subscriptionId: 3, status: 'paid', amount: 500 };
    const { d, logger } = deps(charge, null);
    await expect(
      markChargePaid(d, SUBSCRIPTION_INVID_BASE + 9, 500),
    ).resolves.toEqual({ ok: true });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
