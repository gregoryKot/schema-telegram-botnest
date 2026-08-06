// Покрывает DonationService.create() (валидация суммы, source, dev-путь без
// Robokassa, оплачиваемый путь с paymentUrl) и статический isDonationInvId —
// до этого теста покрыт был только markPaidByInvId.
import { DonationService, DONATION_INVID_BASE } from './donation.service';

function makeService(opts: { robokassaEnabled: boolean; appUrl?: string }) {
  let nextId = 10;
  const rows: Record<number, any> = {};
  const prisma: any = {
    donation: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId++, status: 'pending', ...data };
        rows[row.id] = row;
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => rows[where.id] ?? null),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = rows[where.id];
        if (!row || row.status === 'paid') return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
  };
  const notify = { alertAdmin: jest.fn(async () => undefined) };
  const robokassa = {
    enabled: opts.robokassaEnabled,
    buildPaymentUrl: jest.fn(
      (p: any) =>
        `https://auth.robokassa.ru/x?invId=${p.invId}&sum=${p.amount}`,
    ),
  };
  const config = {
    get: (k: string) => (k === 'APP_URL' ? opts.appUrl : undefined),
  };
  const service = new DonationService(
    prisma,
    robokassa as any,
    notify as any,
    config as any,
  );
  return { service, prisma, notify, robokassa, rows };
}

describe('DonationService.create — валидация суммы', () => {
  it.each([
    ['ниже минимума', 5],
    ['выше максимума', 100_001],
    ['не число', NaN],
  ])('отклоняет сумму: %s', async (_label, amount) => {
    const { service, prisma } = makeService({ robokassaEnabled: false });
    await expect(service.create({ amount })).rejects.toThrow(
      /Сумма должна быть/,
    );
    expect(prisma.donation.create).not.toHaveBeenCalled();
  });

  it('принимает граничные значения MIN и MAX', async () => {
    const { service } = makeService({ robokassaEnabled: false });
    await expect(service.create({ amount: 10 })).resolves.toMatchObject({
      paymentUrl: null,
    });
    await expect(service.create({ amount: 100_000 })).resolves.toMatchObject({
      paymentUrl: null,
    });
  });
});

describe('DonationService.create — Robokassa выключена (dev)', () => {
  it('создаёт донат и сразу помечает paid, возвращает paymentUrl: null', async () => {
    const { service, prisma, notify } = makeService({
      robokassaEnabled: false,
    });
    const result = await service.create({ amount: 300, comment: 'спасибо' });
    expect(result).toEqual({ id: expect.any(Number), paymentUrl: null });
    expect(prisma.donation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: result.id, status: { not: 'paid' } },
        data: expect.objectContaining({ status: 'paid' }),
      }),
    );
    // markPaid шлёт админу карточку доната — подтверждает, что paid-путь реально прошёл.
    expect(notify.alertAdmin).toHaveBeenCalledTimes(1);
    expect(notify.alertAdmin.mock.calls[0][0]).toContain('300 ₽');
  });

  it('source по умолчанию — "app", неизвестное значение source тоже схлопывается в "app"', async () => {
    const { service, prisma } = makeService({ robokassaEnabled: false });
    await service.create({ amount: 50, source: 'nonsense' as any });
    const created = prisma.donation.create.mock.calls[0][0].data;
    expect(created.source).toBe('app');
  });

  it('source: "game" сохраняется как есть', async () => {
    const { service, prisma } = makeService({ robokassaEnabled: false });
    await service.create({ amount: 50, source: 'game' });
    const created = prisma.donation.create.mock.calls[0][0].data;
    expect(created.source).toBe('game');
  });
});

describe('DonationService.create — Robokassa включена', () => {
  it('возвращает paymentUrl с корректным invId (DONATION_INVID_BASE + id) и не помечает paid сразу', async () => {
    const { service, prisma, robokassa } = makeService({
      robokassaEnabled: true,
      appUrl: 'schemehappens.ru',
    });
    const result = await service.create({ amount: 777, email: ' a@b.ru ' });
    expect(result.paymentUrl).toContain(
      String(DONATION_INVID_BASE + result.id),
    );
    expect(prisma.donation.updateMany).not.toHaveBeenCalled();
    const call = robokassa.buildPaymentUrl.mock.calls[0][0];
    expect(call.invId).toBe(DONATION_INVID_BASE + result.id);
    expect(call.amount).toBe(777);
    expect(call.email).toBe('a@b.ru'); // trimmed
    expect(call.successUrl).toBe('https://schemehappens.ru/donate?donation=ok');
    expect(call.failUrl).toBe('https://schemehappens.ru/donate?donation=fail');
  });

  it('email отсутствует — buildPaymentUrl вызывается без email', async () => {
    const { service, robokassa } = makeService({ robokassaEnabled: true });
    await service.create({ amount: 100 });
    const call = robokassa.buildPaymentUrl.mock.calls[0][0];
    expect(call.email).toBeUndefined();
  });
});

describe('DonationService.isDonationInvId', () => {
  it('true на границах диапазона [BASE, 2e9)', () => {
    expect(DonationService.isDonationInvId(DONATION_INVID_BASE)).toBe(true);
    expect(DonationService.isDonationInvId(1_999_999_999)).toBe(true);
  });

  it('false ниже BASE и на верхней границе/выше', () => {
    expect(DonationService.isDonationInvId(DONATION_INVID_BASE - 1)).toBe(
      false,
    );
    expect(DonationService.isDonationInvId(2_000_000_000)).toBe(false);
  });
});
