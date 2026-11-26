// Аудит 2026-10-11: «Booking не хранит сумму счёта» и «цена платной сессии
// может быть 0». Юнит-спеки держат каждую сторону шва отдельно (мок prisma
// ответит что угодно); здесь шов целиком, по HTTP через настоящий AppModule и
// живой Postgres (правила №14, №18): POST /api/booking/book пишет колонку
// Booking.amount, PATCH /api/booking/admin/price меняет цену, вебхук ResultURL
// сверяется со СЧЁТОМ брони, а не с новой ценой. Колонка Int? и чтение
// BookingSetting через драйвер — свойства Postgres и Prisma, не нашего кода.
//
// Только живой Postgres (джоба `migrations`): book берёт advisory-lock через
// $executeRaw, а фейковая Prisma такой сырой SQL не эмулирует.
process.env.ADMIN_BOOKING_KEY = 'e2e-booking-amount-admin-key-0123456789ab';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { SessionType } from '@prisma/client';
import { SESSION_DEFAULT_PRICE } from '../src/booking/booking.config';
import { BookingNotifyService } from '../src/booking/booking-notify.service';
import {
  buildRealDbTestApp,
  RealDbTestApp,
} from './e2e-support/build-real-db-test-app';

const md5 = (s: string): string =>
  createHash('md5').update(s, 'utf8').digest('hex');

const ADMIN_KEY = process.env.ADMIN_BOOKING_KEY;
const PRICE_KEY = 'price:SESSION_50';
// Далеко в будущем и не пересекается с другими спеками (2091-03-04,
// 2092-04-20/21, 2093-05-10, 2094-08-09).
const DATE = '2095-02-13';
const DOW = new Date(`${DATE}T00:00:00Z`).getUTCDay();
const SLOTS = [`${DATE}T09:00:00.000Z`, `${DATE}T11:00:00.000Z`];
const CONTACT = 'e2e-booking-amount@example.com';

describe('e2e: сумма счёта брони — цена на момент записи, платная сессия не за 0', () => {
  let app: INestApplication;
  let prisma: RealDbTestApp['prisma'];
  let ruleId: number | undefined;
  let originalPrice: string | undefined;
  const PASS2 = process.env.ROBOKASSA_PASSWORD2 as string;

  const wipe = async () => {
    await prisma.booking.deleteMany({
      where: { startsAt: { in: SLOTS.map((s) => new Date(s)) } },
    });
    if (ruleId)
      await prisma.availabilityRule.deleteMany({ where: { id: ruleId } });
    // Троттл записи (6/ч на IP) живёт в Postgres и переживает прогон.
    await prisma.throttleHit.deleteMany({});
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await wipe();
    // Цена на живой БД общая для спеков: запоминаем строку и вернём как была.
    originalPrice = (
      await prisma.bookingSetting.findUnique({ where: { key: PRICE_KEY } })
    )?.value;
    jest
      .spyOn(app.get(BookingNotifyService), 'onAwaitingPayment')
      .mockResolvedValue();
    const rule = await request(app.getHttpServer())
      .post('/api/booking/admin/rules')
      .set('x-admin-key', ADMIN_KEY)
      .send({
        dayOfWeek: DOW,
        startHour: 9,
        endHour: 18,
        sessionDuration: 50,
        bufferMin: 10,
        timezone: 'UTC',
      });
    expect(rule.status).toBe(200);
    ruleId = rule.body.id;
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (originalPrice === undefined) {
      await prisma.bookingSetting.deleteMany({ where: { key: PRICE_KEY } });
    } else {
      await prisma.bookingSetting.upsert({
        where: { key: PRICE_KEY },
        create: { key: PRICE_KEY, value: originalPrice },
        update: { value: originalPrice },
      });
    }
    await wipe();
    await app.close();
  });

  const setPrice = (amount: unknown, type = 'SESSION_50') =>
    request(app.getHttpServer())
      .patch('/api/booking/admin/price')
      .set('x-admin-key', ADMIN_KEY)
      .send({ type, amount });
  const optionPrice = async () => {
    const res = await request(app.getHttpServer()).get('/api/booking/options');
    expect(res.status).toBe(200);
    return res.body.find((o: { type: string }) => o.type === 'SESSION_50')
      .price as number;
  };
  const book = async (slot: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/booking/book')
      .send({
        startsAt: slot,
        durationMin: 50,
        type: 'SESSION_50',
        clientName: 'E2E Тест',
        clientContact: CONTACT,
        acceptedOffer: true,
      });
    expect([res.status, res.body.status]).toEqual([200, 'HELD']);
    return { id: String(res.body.id), url: res.body.paymentUrl as string };
  };
  const webhook = (outSum: string, invId: string) =>
    request(app.getHttpServer())
      .post('/api/payment/result')
      .type('form')
      .send({
        OutSum: outSum,
        InvId: invId,
        SignatureValue: md5(`${outSum}:${invId}:${PASS2}`),
      });

  it('запись пишет сумму счёта; цену поменяли; вебхук со СТАРОЙ суммой подтверждает бронь, с новой — FAIL', async () => {
    expect((await setPrice(3000)).status).toBe(200);
    const paid = await book(SLOTS[0]);
    expect(
      (await prisma.booking.findUnique({ where: { id: Number(paid.id) } }))
        ?.amount,
    ).toBe(3000);
    // В Robokassa ушла сохранённая сумма.
    expect(new URL(paid.url).searchParams.get('OutSum')).toBe('3000.00');

    // Вторая бронь, чтобы проверить контроль на другой строке.
    const other = await book(SLOTS[1]);

    // Админ поменял цену, пока клиент на странице оплаты.
    expect((await setPrice(3500)).status).toBe(200);
    expect(await optionPrice()).toBe(3500);

    const ok = await webhook('3000.00', paid.id);
    expect(ok.text).toBe(`OK${paid.id}`);
    const row = await prisma.booking.findUnique({
      where: { id: Number(paid.id) },
    });
    expect(row?.status).toBe('CONFIRMED');
    expect(row?.paidAt).toBeInstanceOf(Date);

    // Контроль: сумма по НОВОЙ цене не равна счёту второй брони — не подтверждаем.
    const fail = await webhook('3500.00', other.id);
    expect(fail.text).toBe(`FAIL${other.id}`);
    const stuck = await prisma.booking.findUnique({
      where: { id: Number(other.id) },
    });
    expect([stuck?.status, stuck?.paidAt]).toEqual(['HELD', null]);
  });

  it('PATCH цены платной сессии на 0, минус и 1e22 — 400, цена в /options прежняя', async () => {
    expect((await setPrice(3200)).status).toBe(200);
    for (const amount of [0, -50, 1e22, 1_000_001]) {
      const res = await setPrice(amount);
      expect([amount, res.status]).toEqual([amount, 400]);
    }
    expect(await optionPrice()).toBe(3200);
  });

  // Знакомство бесплатно по типу (isFree в booking.service.ts), цена в
  // BookingSetting на него не влияет — API её не принимает вовсе.
  it('PATCH цены бесплатного знакомства (INTRO_15) — 400 INTRO_IS_FREE, строка не пишется', async () => {
    for (const amount of [0, 1500]) {
      const res = await setPrice(amount, 'INTRO_15');
      expect([amount, res.status, res.body.message]).toEqual([
        amount,
        400,
        'INTRO_IS_FREE',
      ]);
    }
    expect(
      await prisma.bookingSetting.count({ where: { key: 'price:INTRO_15' } }),
    ).toBe(0);
  });

  it('мусор в BookingSetting ("1e+22", "0") не становится ценой: /options отдаёт дефолт', async () => {
    for (const value of ['1e+22', '0']) {
      await prisma.bookingSetting.upsert({
        where: { key: PRICE_KEY },
        create: { key: PRICE_KEY, value },
        update: { value },
      });
      expect([value, await optionPrice()]).toEqual([
        value,
        SESSION_DEFAULT_PRICE[SessionType.SESSION_50],
      ]);
    }
  });
});
