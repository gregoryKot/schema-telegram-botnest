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
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { TELEGRAF_BOT } from '../src/telegram/telegram.constants';
import {
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

  const seedBooking = (createdAt: Date, paidAt: Date | null = null) =>
    prisma.booking.create({
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
});
