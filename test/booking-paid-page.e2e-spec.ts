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
// Только живой Postgres (джоба `migrations`), как booking-slot-lock.e2e-spec.ts:
// POST /api/booking/book берёт advisory-lock через $executeRaw, а фейковая
// Prisma такой сырой SQL не эмулирует (правило №18).
process.env.ADMIN_BOOKING_KEY = 'e2e-paid-page-admin-key-0123456789abcdef';

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
const PRACTICE = 'kotlarewski.gr';
const OUT_SUM = `${SESSION_DEFAULT_PRICE[SessionType.SESSION_50]}.00`;
// Далеко в будущем и не пересекается с другими спеками (2091-03-04,
// 2092-04-20/21, 2093-05-10).
const DATE = '2094-08-09';
const DOW = new Date(`${DATE}T00:00:00Z`).getUTCDay();
const SLOT = `${DATE}T09:00:00.000Z`;
const CONTACT = 'e2e-paid-page@example.com';

describe('e2e: экран после оплаты — success-redirect без вебхука не превращает HELD в «подтверждено»', () => {
  let app: INestApplication;
  let prisma: RealDbTestApp['prisma'];
  let ruleId: number | undefined;
  const PASS1 = process.env.ROBOKASSA_PASSWORD1 as string;
  const PASS2 = process.env.ROBOKASSA_PASSWORD2 as string;

  const wipe = async () => {
    await prisma.booking.deleteMany({ where: { startsAt: new Date(SLOT) } });
    if (ruleId)
      await prisma.availabilityRule.deleteMany({ where: { id: ruleId } });
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    // Следы прошлого прогона на одной живой БД (правило уйдёт по id в afterAll).
    await prisma.booking.deleteMany({ where: { startsAt: new Date(SLOT) } });
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

  it('контроль: by-token по чужому/неверному токену — 404, а не пустая «успешная» бронь', async () => {
    const res = await byToken('no-such-token');
    expect(res.status).toBe(404);
  });
});
