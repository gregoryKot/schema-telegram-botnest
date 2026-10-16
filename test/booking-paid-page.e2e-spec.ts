// security#15 (аудит 2026-10-11): экран после оплаты (/booking/paid) говорил
// «Встреча подтверждена» по факту владения токеном, хотя SuccessURL приходит
// раньше вебхука ResultURL (или вместо него). Юнит-спеки ловят каждую сторону
// шва отдельно; здесь шов целиком, по HTTP через настоящий AppModule (правило
// №14): настоящая бронь через POST /api/booking/book → подписанный
// GET /api/payment/success (редирект с токеном) → GET /api/booking/by-token
// по токену ИЗ ЭТОГО редиректа. Без вебхука проекция обязана отдавать HELD и
// paid=false — страница по этому не имеет права писать «подтверждена»; после
// вебхука — CONFIRMED и paid=true (read-after-write). Явный Host: страница
// живёт на хосте визитки (правило №19).
//
// Второй шов — блок «Деньги» в /stats («Оплатили сессию», аудит 2026-10-11):
// бесплатное знакомство и бронь, подтверждённая руками админа, оплатой не
// считаются, платёж по подписанному вебхуку — считается. Дельта до/после через
// настоящие пути создания и подтверждения брони, а не вставка строки: БД
// общая для джобы, абсолютные нули тут ненадёжны. Исключение — историческая
// ветка (брони до PAID_AT_TRACKED_SINCE, где paidAt пуст даже у оплаченных):
// createdAt через HTTP не задать, поэтому там строки вставляются напрямую.
//
// Только живой Postgres (джоба `migrations`), как booking-slot-lock.e2e-spec.ts:
// POST /api/booking/book берёт advisory-lock через $executeRaw, а фейковая
// Prisma такой сырой SQL не эмулирует (правило №18).
process.env.ADMIN_BOOKING_KEY = 'e2e-paid-page-admin-key-0123456789abcdef';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { BookingStatus, SessionType } from '@prisma/client';
import { SESSION_DEFAULT_PRICE } from '../src/booking/booking.config';
import { PAID_AT_TRACKED_SINCE } from '../src/booking/booking-paid-at';
import { MoneyMetricsService } from '../src/bot/money-metrics.service';
import { BookingNotifyService } from '../src/booking/booking-notify.service';
import {
  buildRealDbTestApp,
  RealDbTestApp,
} from './e2e-support/build-real-db-test-app';

const md5 = (s: string): string =>
  createHash('md5').update(s, 'utf8').digest('hex');

const ADMIN_KEY = process.env.ADMIN_BOOKING_KEY;
const PRACTICE = 'kotlarewski.gr';
const OUT_SUM = `${SESSION_DEFAULT_PRICE[SessionType.SESSION_50]}.00`;
// Далеко в будущем и не пересекается с другими спеками (2091-03-04,
// 2092-04-20/21, 2093-05-10).
const DATE = '2094-08-09';
const DOW = new Date(`${DATE}T00:00:00Z`).getUTCDay();
const SLOT = `${DATE}T09:00:00.000Z`;
const DAY = {
  gte: new Date(`${DATE}T00:00:00.000Z`),
  lt: new Date(`${DATE}T23:59:59.999Z`),
};
const CONTACT = 'e2e-paid-page@example.com';

describe('e2e: экран после оплаты — success-redirect без вебхука не превращает HELD в «подтверждено»', () => {
  let app: INestApplication;
  let prisma: RealDbTestApp['prisma'];
  let ruleId: number | undefined;
  const PASS1 = process.env.ROBOKASSA_PASSWORD1 as string;
  const PASS2 = process.env.ROBOKASSA_PASSWORD2 as string;

  const wipe = async () => {
    await prisma.booking.deleteMany({ where: { startsAt: DAY } });
    if (ruleId)
      await prisma.availabilityRule.deleteMany({ where: { id: ruleId } });
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    // Следы прошлого прогона на одной живой БД (правило уйдёт по id в afterAll).
    await prisma.booking.deleteMany({ where: { startsAt: DAY } });
    // POST /api/booking/book считает попытки в Postgres (6 в час на IP) и
    // переживает пересоздание app. Шаг CI без E2E_REAL_DB не сбрасывает их
    // между файлами (throttle-reset.setup.ts), и счётчик соседних спеков
    // давал 429 на второй же заявке этого файла: у файла свой бюджет.
    await prisma.throttleHit.deleteMany({});
    // Уведомления админу наружу не ходят (бот/почта в e2e не настроены).
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
    await wipe();
    await app.close();
  });

  const byToken = (token: string) =>
    request(app.getHttpServer()).get(`/api/booking/by-token/${token}`);

  it('book → success без вебхука → by-token: HELD и paid=false; после вебхука CONFIRMED и paid=true', async () => {
    const book = await request(app.getHttpServer())
      .post('/api/booking/book')
      .send({
        startsAt: SLOT,
        durationMin: 50,
        type: 'SESSION_50',
        clientName: 'E2E Тест',
        clientContact: CONTACT,
        acceptedOffer: true,
      });
    expect([book.status, book.body.status]).toEqual([200, 'HELD']);
    const invId = String(book.body.id);

    // Браузер вернулся с Robokassa раньше вебхука: подпись SuccessURL верна.
    const success = await request(app.getHttpServer())
      .get(
        `/api/payment/success?InvId=${invId}&OutSum=${OUT_SUM}&SignatureValue=${md5(`${OUT_SUM}:${invId}:${PASS1}`)}`,
      )
      .set('Host', PRACTICE);
    expect(success.status).toBe(302);
    const target = new URL(success.headers.location);
    expect([target.host, target.pathname]).toEqual([PRACTICE, '/booking/paid']);
    const token = target.searchParams.get('token') as string;
    expect(token).toBeTruthy();

    // Страница читает бронь по токену из редиректа: ещё не подтверждена.
    const before = await byToken(token);
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({ status: 'HELD', paid: false });

    // Вебхук ResultURL пришёл.
    const webhook = await request(app.getHttpServer())
      .post('/api/payment/result')
      .type('form')
      .send({
        OutSum: OUT_SUM,
        InvId: invId,
        SignatureValue: md5(`${OUT_SUM}:${invId}:${PASS2}`),
      });
    expect(webhook.text).toBe(`OK${invId}`);

    const after = await byToken(token);
    expect(after.body).toMatchObject({ status: 'CONFIRMED', paid: true });
    // Проекция публичная: ни метки оплаты, ни PII.
    expect(after.body).not.toHaveProperty('paidAt');
    expect(after.body).not.toHaveProperty('clientContact');
  });

  it('«Оплатили сессию» в /stats: знакомство и ручное подтверждение не в счёте, вебхук — в счёте', async () => {
    const metrics = app.get(MoneyMetricsService, { strict: false });
    const book = (type: string, hour: number, durationMin: number) =>
      request(app.getHttpServer())
        .post('/api/booking/book')
        .send({
          startsAt: `${DATE}T${hour}:00:00.000Z`,
          durationMin,
          type,
          clientName: 'E2E Тест',
          clientContact: CONTACT,
          acceptedOffer: true,
        });
    const before = await metrics.getMetrics();

    // 1. Бесплатное знакомство: сразу CONFIRMED, paidAt пуст.
    const intro = await book('INTRO_15', 11, 15);
    expect([intro.status, intro.body.status]).toEqual([200, 'CONFIRMED']);

    // 2. Платная сессия, подтверждённая руками админа: CONFIRMED без paidAt.
    const manual = await book('SESSION_50', 13, 50);
    expect([manual.status, manual.body.status]).toEqual([200, 'HELD']);
    const confirm = await request(app.getHttpServer())
      .post(`/api/booking/admin/confirm/${manual.body.id}`)
      .set('x-admin-key', ADMIN_KEY);
    expect(confirm.status).toBe(200);
    const manualRow = await prisma.booking.findUnique({
      where: { id: manual.body.id },
    });
    expect([manualRow?.status, manualRow?.paidAt]).toEqual(['CONFIRMED', null]);

    // Ни знакомство, ни ручное подтверждение не сдвинули счётчик.
    const mid = await metrics.getMetrics();
    expect([
      mid.week.paidSessions - before.week.paidSessions,
      mid.allTime.paidSessions - before.allTime.paidSessions,
    ]).toEqual([0, 0]);

    // 3. Платная сессия, оплаченная по подписанному вебхуку: ровно +1.
    const paid = await book('SESSION_50', 15, 50);
    const invId = String(paid.body.id);
    const webhook = await request(app.getHttpServer())
      .post('/api/payment/result')
      .type('form')
      .send({
        OutSum: OUT_SUM,
        InvId: invId,
        SignatureValue: md5(`${OUT_SUM}:${invId}:${PASS2}`),
      });
    expect(webhook.text).toBe(`OK${invId}`);

    const after = await metrics.getMetrics();
    expect([
      after.week.paidSessions - before.week.paidSessions,
      after.allTime.paidSessions - before.allTime.paidSessions,
    ]).toEqual([1, 1]);
  });

  it('«Оплатили сессию» за всё время, история до учёта paidAt: обычная бронь в счёте, знакомство нет', async () => {
    const metrics = app.get(MoneyMetricsService, { strict: false });
    // До PAID_AT_TRACKED_SINCE paidAt пуст даже у оплаченных броней, и счёт
    // «только по paidAt» обнулил бы строку «За всё время» (money-metrics.paid-
    // sessions.ts): для них действует прежнее правило CONFIRMED/COMPLETED, но
    // без знакомств. createdAt через HTTP не задать — вставка напрямую; слот
    // в DAY, чтобы wipe() подчистил строки вместе с остальными.
    const created = new Date(PAID_AT_TRACKED_SINCE.getTime() - 86_400_000);
    const historical = (type: SessionType, hour: number, durationMin: number) =>
      prisma.booking.create({
        data: {
          startsAt: new Date(`${DATE}T${hour}:00:00.000Z`),
          durationMin,
          type,
          status: BookingStatus.CONFIRMED,
          clientName: 'E2E Тест',
          clientContact: CONTACT,
          cancelToken: `e2e-paid-page-historical-${type}`,
          createdAt: created,
        },
      });
    const before = await metrics.getMetrics();

    await historical(SessionType.SESSION_50, 17, 50);
    await historical(SessionType.INTRO_15, 18, 15);

    const after = await metrics.getMetrics();
    // Ровно +1: платная в счёте, знакомство нет (+2 — знакомство просочилось,
    // 0 — историческая ветка пропала). Окно «за неделю» не проверяем: createdAt
    // в прошлом, и от часов теста зависело бы, попала ли строка в окно.
    expect(after.allTime.paidSessions - before.allTime.paidSessions).toBe(1);
  });

  it('контроль: by-token по чужому/неверному токену — 404, а не пустая «успешная» бронь', async () => {
    const res = await byToken('no-such-token');
    expect(res.status).toBe(404);
  });
});
