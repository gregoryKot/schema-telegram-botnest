// Регресс инцидента 2026-09-13: запись на консультацию (POST /api/booking/book)
// отвечала 500 на КАЖДОЙ попытке — «Failed to deserialize column of type
// 'void'». Advisory-lock брался через `$queryRaw`, а Prisma 7 с driver-adapter
// не умеет прочитать колонку типа `void`, которую возвращает
// `pg_advisory_xact_lock`. 12 юнит-спеков бронирования были зелёными: все они
// мокали `tx.$queryRaw` и по построению не могли увидеть свойство драйвера.
//
// Поэтому — только живой Postgres (CI-джоба `migrations`): сначала сам лок в
// настоящей транзакции, затем весь путь пользователя по HTTP — реальный
// AppModule, ValidationPipe, настоящая БД — и read-after-write: бронь видна
// и через Prisma, и через публичный GET по токену.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { lockBookingSlots } from '../src/booking/booking-slot-lock';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';

// Фиксированный слот далеко в будущем: startsAt не шифруется, по нему спек
// чистит за собой (на одной БД гоняется подряд — второй прогон иначе получал бы
// 409 «слот занят» от собственной прошлой брони).
const FIXTURE_STARTS_AT = new Date('2091-03-04T10:00:00.000Z');

describe('advisory-lock бронирования на реальном Postgres', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('лок берётся внутри настоящей транзакции без ошибки десериализации', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await lockBookingSlots(tx);
        return 'locked';
      }),
    ).resolves.toBe('locked');
  });

  it('контроль: тот же запрос через $queryRaw драйвер прочитать не может', async () => {
    // Если этот тест когда-нибудь позеленеет — Prisma научилась читать `void`,
    // и защита выше стала излишней; но пока это так, `$executeRaw` обязателен.
    await expect(
      prisma.$transaction(
        async (tx) => tx.$queryRaw`SELECT pg_advisory_xact_lock(${911_001})`,
      ),
    ).rejects.toThrow(/void/);
  });
});

describe('e2e: запись на консультацию по HTTP на реальном Postgres', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await prisma.booking.deleteMany({ where: { startsAt: FIXTURE_STARTS_AT } });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { startsAt: FIXTURE_STARTS_AT } });
    await app.close();
  });

  it('бесплатное знакомство: 200, бронь в БД со статусом CONFIRMED и видна по токену', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking/book')
      .send({
        startsAt: FIXTURE_STARTS_AT.toISOString(),
        durationMin: 15,
        type: 'INTRO_15',
        clientName: 'Проверка e2e',
        clientContact: 'e2e-booking-lock@example.com',
        acceptedOffer: true,
      });

    expect(res.status).toBe(200);

    const rows = await prisma.booking.findMany({
      where: { startsAt: FIXTURE_STARTS_AT },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('CONFIRMED');

    const byToken = await request(app.getHttpServer()).get(
      `/api/booking/by-token/${rows[0].cancelToken}`,
    );
    expect(byToken.status).toBe(200);
    expect(new Date(byToken.body.startsAt).getTime()).toBe(
      FIXTURE_STARTS_AT.getTime(),
    );
  });
});
