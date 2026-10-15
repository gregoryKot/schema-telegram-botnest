// Две пробы приёма оплаты (аудит 2026-10-11). Площадку не вызывают: проверяют
// конфигурацию и следы настоящих вебхуков в нашей БД.
import { SessionType } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  PAID_AT_TRACKED_SINCE,
  paymentWebhooksProbe,
  robokassaConfigProbe,
  robokassaProbes,
  SILENT_ATTEMPTS_LIMIT,
} from './probe-robokassa';

const PROD = {
  NODE_ENV: 'production',
  ROBOKASSA_MERCHANT_LOGIN: 'shop',
  ROBOKASSA_PASSWORD1: 'p1',
  ROBOKASSA_PASSWORD2: 'p2',
};

describe('robokassaConfigProbe', () => {
  it('прод без переменных — не ok, называет их и последствие', async () => {
    const res = await robokassaConfigProbe({ NODE_ENV: 'production' }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('оплата не настроена');
    expect(res.detail).toContain('ROBOKASSA_PASSWORD2');
  });

  it('прод с тестовым режимом — не ok', async () => {
    const res = await robokassaConfigProbe({
      ...PROD,
      ROBOKASSA_IS_TEST: 'true',
    }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('тестовый режим');
  });

  it('прод, настроено, рабочий режим — ok', async () => {
    const res = await robokassaConfigProbe({
      ...PROD,
      ROBOKASSA_IS_TEST: 'false',
    }).run();
    expect(res).toEqual({ ok: true, detail: 'настроена, рабочий режим' });
  });

  it('не прод — ok, даже без переменных и с тестовым режимом', async () => {
    const bare = await robokassaConfigProbe({ NODE_ENV: 'test' }).run();
    const test = await robokassaConfigProbe({
      NODE_ENV: 'development',
      ROBOKASSA_IS_TEST: 'true',
    }).run();
    expect([bare.ok, test.ok]).toEqual([true, true]);
  });

  it('в /health попадает (reportInHealth не выключен)', () => {
    expect(robokassaConfigProbe({}).reportInHealth).not.toBe(false);
  });
});

type Counts = { booking?: number; donation?: number; charge?: number };

function fakePrisma(
  paid: { booking?: Date | null; donation?: Date | null; charge?: Date | null },
  counts: Counts,
) {
  const agg = (d?: Date | null) =>
    jest.fn().mockResolvedValue({ _max: { paidAt: d ?? null } });
  const prisma = {
    booking: {
      aggregate: agg(paid.booking),
      count: jest.fn().mockResolvedValue(counts.booking ?? 0),
    },
    donation: {
      aggregate: agg(paid.donation),
      count: jest.fn().mockResolvedValue(counts.donation ?? 0),
    },
    subscriptionCharge: {
      aggregate: agg(paid.charge),
      count: jest.fn().mockResolvedValue(counts.charge ?? 0),
    },
  };
  return prisma as unknown as PrismaService & typeof prisma;
}

const NOW = Date.parse('2026-10-25T12:00:00Z');

describe('paymentWebhooksProbe', () => {
  it('в /health не попадает: отказ клиентов не должен ронять prod-smoke', () => {
    expect(paymentWebhooksProbe(fakePrisma({}, {}), PROD).reportInHealth).toBe(
      false,
    );
  });

  it('пустая БД — ok без null/NaN в тексте', async () => {
    const res = await paymentWebhooksProbe(
      fakePrisma({}, {}),
      PROD,
      () => NOW,
    ).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('неподтверждённых попыток нет');
    expect(res.detail).toContain('с начала учёта оплат не было');
    expect(res.detail).not.toMatch(/null|NaN|undefined/);
  });

  it(`${SILENT_ATTEMPTS_LIMIT} истёкших попыток после последней оплаты — не ok, с датой`, async () => {
    const res = await paymentWebhooksProbe(
      fakePrisma(
        {
          booking: new Date('2026-10-16T09:00:00Z'),
          donation: new Date('2026-10-18T09:00:00Z'),
        },
        { booking: 3, donation: 1, charge: 1 },
      ),
      PROD,
      () => NOW,
    ).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain(`${SILENT_ATTEMPTS_LIMIT} попыток`);
    expect(res.detail).toContain('последняя оплата 18.10');
  });

  it('на одну попытку меньше порога — ещё ok, но число видно', async () => {
    const res = await paymentWebhooksProbe(
      fakePrisma({}, { booking: SILENT_ATTEMPTS_LIMIT - 1 }),
      PROD,
      () => NOW,
    ).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain(
      `${SILENT_ATTEMPTS_LIMIT - 1} из ${SILENT_ATTEMPTS_LIMIT}`,
    );
  });

  it('запрос попыток: после последней оплаты, старше 15 минут, только платные брони', async () => {
    const last = new Date('2026-10-20T10:00:00Z');
    const prisma = fakePrisma({ booking: last }, {});
    await paymentWebhooksProbe(prisma, PROD, () => NOW).run();
    const createdAt = { gt: last, lt: new Date(NOW - 15 * 60_000) };
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        paidAt: null,
        type: { not: SessionType.INTRO_15 },
        createdAt,
      }),
    });
    expect(prisma.donation.count).toHaveBeenCalledWith({
      where: { paidAt: null, status: 'pending', createdAt },
    });
    expect(prisma.subscriptionCharge.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ isFirst: true, createdAt }),
    });
  });

  it('без оплат нижняя граница — начало учёта paidAt, а не вся история', async () => {
    const prisma = fakePrisma({}, {});
    await paymentWebhooksProbe(prisma, PROD, () => NOW).run();
    const createdAt = {
      gt: PAID_AT_TRACKED_SINCE,
      lt: new Date(NOW - 15 * 60_000),
    };
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ createdAt }),
    });
    expect(prisma.donation.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ createdAt }),
    });
  });

  it('оплата старше начала учёта границу не двигает назад', async () => {
    const prisma = fakePrisma(
      { donation: new Date('2026-06-30T09:00:00Z') },
      {},
    );
    await paymentWebhooksProbe(prisma, PROD, () => NOW).run();
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        createdAt: expect.objectContaining({ gt: PAID_AT_TRACKED_SINCE }),
      }),
    });
  });

  it('попытки до начала учёта paidAt не считаются: старые отменённые брони не красят пробу', async () => {
    // Фейк отдаёт «пять» только на запросе, чья нижняя граница не позже начала
    // учёта; как это решает настоящая БД, доказывает e2e на живом Postgres.
    const prisma = fakePrisma({}, {});
    (prisma.booking.count as jest.Mock).mockImplementation(
      ({ where }: { where: { createdAt: { gt: Date } } }) =>
        Promise.resolve(where.createdAt.gt < PAID_AT_TRACKED_SINCE ? 9 : 0),
    );
    const res = await paymentWebhooksProbe(prisma, PROD, () => NOW).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('неподтверждённых попыток нет');
  });

  it('контроль: пять попыток после начала учёта и без оплат — красная', async () => {
    const prisma = fakePrisma({}, { booking: SILENT_ATTEMPTS_LIMIT });
    const res = await paymentWebhooksProbe(prisma, PROD, () => NOW).run();
    expect(res.ok).toBe(false);
  });

  it('не прод и «не настроено» — пропускается без запросов в БД', async () => {
    const prisma = fakePrisma({}, {});
    const dev = await paymentWebhooksProbe(prisma, { NODE_ENV: 'test' }).run();
    const bare = await paymentWebhooksProbe(prisma, {
      NODE_ENV: 'production',
    }).run();
    expect([dev.ok, bare.ok]).toEqual([true, true]);
    expect(prisma.booking.aggregate).not.toHaveBeenCalled();
  });

  it('БД упала — проба не бросает, а возвращает ok:false с описанием', async () => {
    const prisma = fakePrisma({}, {});
    (prisma.booking.aggregate as jest.Mock).mockRejectedValue(
      new Error('connection refused'),
    );
    const res = await paymentWebhooksProbe(prisma, PROD).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('connection refused');
  });
});

describe('robokassaProbes', () => {
  it('две пробы с разными id', () => {
    expect(robokassaProbes(fakePrisma({}, {})).map((p) => p.id)).toEqual([
      'robokassa',
      'paymentWebhooks',
    ]);
  });
});
