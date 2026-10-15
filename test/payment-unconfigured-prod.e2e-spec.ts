// Аудит 2026-10-11: в проде со снятыми ROBOKASSA_* платные пути подтверждались
// без денег: бронь SESSION_50 → CONFIRMED, донат → «оплачен» + DM «💛 Донат».
// Теперь прод без Robokassa отвечает 503 PAYMENT_UNAVAILABLE ДО записи в БД, а
// бесплатное знакомство работает как раньше. Не-прод без Robokassa — прежнее
// автоподтверждение (контрольные случаи ниже).
//
// Только живой Postgres (CI-джоба `migrations`, правило №18): «в БД не появилось
// ни брони, ни доната» и условия проб оплаты — свойства настоящих запросов, а не
// аргументов мока. env.setup.ts задаёт ROBOKASSA_* на этапе загрузки, а
// RobokassaService читает их в конструкторе, поэтому снимаем их ДО сборки
// приложения. NODE_ENV=production включается только на время запроса (гард
// читает его при вызове, не при старте).
process.env.ADMIN_ID = '424242';
delete process.env.ROBOKASSA_MERCHANT_LOGIN;
delete process.env.ROBOKASSA_PASSWORD1;
delete process.env.ROBOKASSA_PASSWORD2;

import { INestApplication, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { TELEGRAF_BOT } from '../src/telegram/telegram.constants';
import {
  PAID_AT_TRACKED_SINCE,
  paymentWebhooksProbe,
  SILENT_ATTEMPTS_LIMIT,
} from '../src/infra/self-check/probe-robokassa';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';

const CONTACT = 'unpaid-prod@example.com';
// Email и comment доната шифруются в БД, искать по ним нельзя — фикстуры
// узнаём по необычной сумме.
const DONATION_AMOUNT = 731;
const PROBE_DONATION_AMOUNT = 733;
// Тот же будний день и окно расписания, что у booking-returning-oracle.
const SLOT_REFUSED = new Date('2095-03-07T10:00:00.000Z');
const SLOT_INTRO = new Date('2095-03-07T12:00:00.000Z');
const SLOT_DEV = new Date('2095-03-07T14:00:00.000Z');

const bookBody = (type: string, startsAt: Date) => ({
  startsAt: startsAt.toISOString(),
  durationMin: type === 'INTRO_15' ? 15 : 50,
  type,
  clientName: 'Проверка оплаты',
  clientContact: CONTACT,
  acceptedOffer: true,
});

describe('e2e: прод без Robokassa не подтверждает платное без денег', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminDms: () => string[];
  const was = process.env.NODE_ENV;

  const inProd = async <T>(fn: () => Promise<T>): Promise<T> => {
    process.env.NODE_ENV = 'production';
    try {
      return await fn();
    } finally {
      process.env.NODE_ENV = was;
    }
  };

  const cleanup = async () => {
    await prisma.booking.deleteMany({
      where: { startsAt: { in: [SLOT_REFUSED, SLOT_INTRO, SLOT_DEV] } },
    });
    await prisma.donation.deleteMany({
      where: { amount: { in: [DONATION_AMOUNT, PROBE_DONATION_AMOUNT] } },
    });
    // Троттл записи и доната живёт в Postgres и переживает прогон.
    await prisma.throttleHit.deleteMany({});
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await cleanup();
    const bot = app.get(TELEGRAF_BOT);
    bot.telegram.sendMessage.mockClear();
    adminDms = () =>
      bot.telegram.sendMessage.mock.calls.map((c: unknown[]) => String(c[1]));
    // Отказ пишет logger.error — в проде это DM владельцу; тесту шум не нужен.
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterAll(async () => {
    await cleanup();
    jest.restoreAllMocks();
    await app.close();
  });

  it('SESSION_50: 503 PAYMENT_UNAVAILABLE, брони в БД нет, заявка ушла владельцу лидом', async () => {
    const res = await inProd(() =>
      request(app.getHttpServer())
        .post('/api/booking/book')
        .send(bookBody('SESSION_50', SLOT_REFUSED)),
    );
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('PAYMENT_UNAVAILABLE');
    expect(
      await prisma.booking.count({ where: { startsAt: SLOT_REFUSED } }),
    ).toBe(0);
    const leads = adminDms().filter((t) => t.includes(CONTACT));
    expect(leads).toHaveLength(1);
    expect(leads[0]).toContain('Проверка оплаты');
  });

  it('контроль: INTRO_15 в том же окружении подтверждается как раньше', async () => {
    const res = await inProd(() =>
      request(app.getHttpServer())
        .post('/api/booking/book')
        .send(bookBody('INTRO_15', SLOT_INTRO)),
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
    const row = await prisma.booking.findFirst({
      where: { startsAt: SLOT_INTRO },
    });
    expect(row?.status).toBe('CONFIRMED');
  });

  it('донат: 503, строки в БД нет, «Донат» владельцу не уходит', async () => {
    const before = adminDms().filter((t) => t.includes('Донат')).length;
    const res = await inProd(() =>
      request(app.getHttpServer())
        .post('/api/donation')
        .send({ amount: DONATION_AMOUNT }),
    );
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('PAYMENT_UNAVAILABLE');
    expect(
      await prisma.donation.count({ where: { amount: DONATION_AMOUNT } }),
    ).toBe(0);
    expect(adminDms().filter((t) => t.includes('Донат'))).toHaveLength(before);
  });

  it('контроль, не прод: SESSION_50 и донат подтверждаются сразу (режим разработки)', async () => {
    const booking = await request(app.getHttpServer())
      .post('/api/booking/book')
      .send(bookBody('SESSION_50', SLOT_DEV));
    expect(booking.status).toBe(200);
    expect(booking.body.status).toBe('CONFIRMED');
    expect(booking.body.paymentUrl).toBeNull();

    const donation = await request(app.getHttpServer())
      .post('/api/donation')
      .send({ amount: DONATION_AMOUNT });
    expect(donation.status).toBe(200);
    expect(donation.body.paymentUrl).toBeNull();
    const row = await prisma.donation.findFirst({
      where: { amount: DONATION_AMOUNT },
    });
    expect(row?.status).toBe('paid');
  });
});

// Проба «приходят ли подтверждения» на настоящих запросах Postgres. Метки
// времени — в 2096 году и `now` оттуда же: проба смотрит всю таблицу, а строки
// других спеков живут в настоящем и не попадают ни в «последнюю оплату», ни в
// окно попыток.
describe('e2e: проба paymentWebhooks на живой БД', () => {
  let prisma: PrismaService;
  let app: INestApplication;
  const PROD_ENV = {
    NODE_ENV: 'production',
    ROBOKASSA_MERCHANT_LOGIN: 'shop',
    ROBOKASSA_PASSWORD1: 'p1',
    ROBOKASSA_PASSWORD2: 'p2',
  };
  const day = (d: number) => new Date(Date.UTC(2096, 0, d));
  const NOW = day(10).getTime();
  const PROBE_SLOT = day(20); // по нему фикстуры находит чистка: контакт шифруется

  const seedBooking = (
    createdAt: Date,
    paidAt: Date | null = null,
    db: Pick<Prisma.TransactionClient, 'booking'> = prisma,
  ) =>
    db.booking.create({
      data: {
        startsAt: PROBE_SLOT,
        durationMin: 50,
        type: 'SESSION_50',
        status: paidAt ? 'CONFIRMED' : 'CANCELLED',
        clientName: 'Проба',
        clientContact: 'unpaid-prod-probe@example.com',
        cancelToken: `probe-${createdAt.getTime()}-${Math.random()}`,
        createdAt,
        paidAt,
      },
    });
  const run = () => paymentWebhooksProbe(prisma, PROD_ENV, () => NOW).run();

  const cleanup = async () => {
    await prisma.booking.deleteMany({ where: { startsAt: PROBE_SLOT } });
    await prisma.donation.deleteMany({
      where: { amount: PROBE_DONATION_AMOUNT },
    });
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('серия брошенных оплат после последней настоящей — проба красная', async () => {
    await seedBooking(day(1), day(1)); // последняя настоящая оплата
    for (let i = 0; i < SILENT_ATTEMPTS_LIMIT - 1; i += 1) {
      await seedBooking(new Date(day(2).getTime() + i));
    }
    await prisma.donation.create({
      data: {
        amount: PROBE_DONATION_AMOUNT,
        status: 'pending',
        createdAt: day(3),
      },
    });
    const res = await run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain(`${SILENT_ATTEMPTS_LIMIT} попыток`);
    expect(res.detail).toContain('01.01');
  });

  it('новая настоящая оплата обнуляет серию', async () => {
    await seedBooking(day(4), day(4));
    const res = await run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('неподтверждённых попыток нет');
  });

  // Граница учёта paidAt (PAID_AT_TRACKED_SINCE): Booking.paidAt появился в
  // миграции, у старых броней он NULL даже там, где деньги пришли. Без нижней
  // границы по createdAt проба считала бы за серию всю историю брошенных холдов
  // и отменённых оплат. Проба берёт максимум paidAt по ВСЕЙ таблице, поэтому
  // оплаты соседних спеков и тестов выше сдвинули бы границу вперёд и спрятали
  // дефект: мир проверки собирается в транзакции с откатом. Внутри ни одной
  // оплаты, снаружи ничего не тронуто (чужие строки тоже).
  class Rollback extends Error {}
  const inCleanWorld = async (
    body: (tx: Prisma.TransactionClient) => Promise<void>,
  ) => {
    await prisma
      .$transaction(
        async (tx) => {
          const unpaid = {
            where: { paidAt: { not: null } },
            data: { paidAt: null },
          };
          await tx.booking.updateMany(unpaid);
          await tx.donation.updateMany(unpaid);
          await tx.subscriptionCharge.updateMany(unpaid);
          await body(tx);
          throw new Rollback();
        },
        { timeout: 30_000 },
      )
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });
  };
  const OLD = new Date(PAID_AT_TRACKED_SINCE.getTime() - 14 * 86_400_000);
  // Окно попыток кончается за 15 минут до now: первые 45 минут после начала
  // учёта — самое раннее окно, в него не попадают строки чужих прогонов.
  const EARLY_NOW = PAID_AT_TRACKED_SINCE.getTime() + 60 * 60_000;
  const minutes = (from: Date, n: number) =>
    new Date(from.getTime() + n * 60_000);

  it.each([
    ['оплат не было вовсе', null],
    ['последняя оплата старше начала учёта', new Date('2026-06-30T09:00:00Z')],
  ])(
    'брошенные оплаты до начала учёта не считаются (%s), после начала — считаются',
    async (_name, oldPaidAt) => {
      await inCleanWorld(async (tx) => {
        for (let i = 0; i < SILENT_ATTEMPTS_LIMIT - 1; i += 1) {
          await seedBooking(minutes(OLD, i), null, tx);
        }
        for (let i = 0; i < 3; i += 1) {
          await tx.donation.create({
            data: {
              amount: PROBE_DONATION_AMOUNT,
              status: 'pending',
              createdAt: minutes(OLD, 10 + i),
            },
          });
        }
        if (oldPaidAt) await seedBooking(oldPaidAt, oldPaidAt, tx);
        const probe = () =>
          paymentWebhooksProbe(
            tx as unknown as PrismaService,
            PROD_ENV,
            () => EARLY_NOW,
          ).run();

        const quiet = await probe();
        expect(quiet.ok).toBe(true);
        expect(quiet.detail).toContain('неподтверждённых попыток нет');

        // Контроль: те же запросы считают попытки после начала учёта.
        for (let i = 1; i <= SILENT_ATTEMPTS_LIMIT; i += 1) {
          await seedBooking(minutes(PAID_AT_TRACKED_SINCE, i), null, tx);
        }
        const loud = await probe();
        expect(loud.ok).toBe(false);
        expect(loud.detail).toMatch(
          new RegExp(`^${SILENT_ATTEMPTS_LIMIT} попыток`),
        );
        expect(loud.detail).toContain('с начала учёта 15.10 оплат не было');
        expect(loud.detail).not.toContain('30.06');
      });
    },
  );
});
