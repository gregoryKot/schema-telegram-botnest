// TEST_IMPROVEMENT_PLAN.md, этап 1.4: платёжный контур (Robokassa) поднят на
// настоящем HTTP-стеке. payment.controller.spec.ts уже проверяет
// PaymentController напрямую (реальный RobokassaService + шпионы вместо
// booking/donation/subscription) — здесь тот же контур идёт через реальный
// AppModule (guard/pipe/DI/express body-parser, как в проде) + фейковую БД
// (fake-prisma.ts), с read-after-write проверкой состояния после вебхука —
// именно там (не на «сохранилось ли» самой команды) обычно живут баги на
// стыке модулей.
//
// Один общий Robokassa ResultURL (POST /api/payment/result) делит booking/
// donation/subscription по диапазону InvId — см. payment.controller.ts.
// Сценарий 4 — регресс бага №5 из PR #66 (расхождение суммы должно блокировать
// авто-подтверждение брони, не просто алертить), поднятый с юнита на HTTP.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupPaymentFixtures } from './e2e-support/cleanup-fixtures';
import { DONATION_INVID_BASE } from '../src/donation/donation.service';
import { SUBSCRIPTION_INVID_BASE } from '../src/subscription/subscription.service';

function md5(s: string): string {
  return createHash('md5').update(s, 'utf8').digest('hex');
}

// Идентификаторы фикстур этого спека (TEST_TRUST_PLAN.md, п.1) — на реальном
// Postgres спек гоняется трижды подряд на одной БД (проверка идемпотентности
// вебхука), поэтому чистка в beforeAll обязана знать точные токены/маркер,
// иначе второй прогон падает на unique-констрейнте cancelToken.
const BOOKING_CANCEL_TOKENS = ['bk-ct-1', 'bk-ct-2', 'bk-ct-3', 'bk-ct-4'];
const SUBSCRIPTION_CANCEL_TOKENS = ['sub-ct-1', 'sub-ct-2', 'sub-ct-3'];
const DONATION_MARKER = 'e2e-payment-webhook-test';
const TEST_CLIENT_CONTACT = 't@e.co';

describe('e2e smoke: платёжный контур Robokassa по HTTP', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const PASS2 = process.env.ROBOKASSA_PASSWORD2 as string;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    // Чистый старт — на фейке no-op (свежий in-memory прогон), на реальном
    // Postgres вычищает фикстуры прошлого прогона этого же спека (см. комментарий
    // выше и cleanupPaymentFixtures в e2e-support/cleanup-fixtures.ts).
    await cleanupPaymentFixtures(prisma, {
      bookingCancelTokens: BOOKING_CANCEL_TOKENS,
      subscriptionCancelTokens: SUBSCRIPTION_CANCEL_TOKENS,
      donationMarker: DONATION_MARKER,
      clientContacts: [TEST_CLIENT_CONTACT],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ._rows — фейк-Prisma-специфичный доступ к in-memory массиву
  // (fake-prisma.ts), недоступный на реальном PrismaService. findUnique/count
  // работают одинаково в обоих режимах — читаем состояние только через них.
  async function bookingStatus(id: number): Promise<string | undefined> {
    const row = await prisma.booking.findUnique({ where: { id } });
    return row?.status;
  }
  async function donationStatus(id: number): Promise<string | undefined> {
    const row = await prisma.donation.findUnique({ where: { id } });
    return row?.status;
  }
  async function subscriptionStatus(id: number): Promise<string | undefined> {
    const row = await prisma.subscription.findUnique({ where: { id } });
    return row?.status;
  }
  async function chargeStatus(id: number): Promise<string | undefined> {
    const row = await prisma.subscriptionCharge.findUnique({ where: { id } });
    return row?.status;
  }

  // MD5(OutSum:InvId:Password2) — та же формула, что RobokassaService.validateWebhook.
  function resultSig(outSum: string, invId: string): string {
    return md5(`${outSum}:${invId}:${PASS2}`);
  }

  function postResult(outSum: string, invId: string, sig: string) {
    return request(app.getHttpServer())
      .post('/api/payment/result')
      .send({ OutSum: outSum, InvId: invId, SignatureValue: sig });
  }

  function makeHeldBooking(cancelToken: string) {
    return prisma.booking.create({
      data: {
        startsAt: new Date(Date.now() + 3_600_000),
        durationMin: 50,
        type: 'SESSION_50', // default price 4000₽ — см. booking.config.ts
        status: 'HELD',
        heldUntil: new Date(Date.now() + 15 * 60_000),
        clientName: 'Клиент',
        clientContact: TEST_CLIENT_CONTACT,
        cancelToken,
      },
    });
  }

  // ─── Бронь: обычный InvId-диапазон ────────────────────────────────────────

  describe('booking webhook', () => {
    it('валидная подпись → OK + бронь CONFIRMED (read-after-write)', async () => {
      const booking = await makeHeldBooking('bk-ct-1');
      const outSum = '4000.00';
      const invId = String(booking.id);

      const res = await postResult(outSum, invId, resultSig(outSum, invId));

      expect(res.status).toBe(200);
      expect(res.text).toBe(`OK${invId}`);
      expect(await bookingStatus(booking.id)).toBe('CONFIRMED');
    });

    it('невалидная подпись → FAIL, бронь остаётся HELD (состояние не изменилось)', async () => {
      const booking = await makeHeldBooking('bk-ct-2');
      const invId = String(booking.id);

      const res = await postResult('4000.00', invId, 'deadbeef');

      expect(res.text).toBe(`FAIL${invId}`);
      expect(await bookingStatus(booking.id)).toBe('HELD');
    });

    it('идемпотентный повтор того же уведомления → OK, без дублей', async () => {
      const booking = await makeHeldBooking('bk-ct-3');
      const outSum = '4000.00';
      const invId = String(booking.id);
      const sig = resultSig(outSum, invId);

      const first = await postResult(outSum, invId, sig);
      expect(first.text).toBe(`OK${invId}`);
      expect(await bookingStatus(booking.id)).toBe('CONFIRMED');

      const second = await postResult(outSum, invId, sig);
      expect(second.status).toBe(200);
      expect(second.text).toBe(`OK${invId}`);
      // без дублей: ровно одна строка с этим id, а не новая запись поверх старой.
      expect(await prisma.booking.count({ where: { id: booking.id } })).toBe(1);
      expect(await bookingStatus(booking.id)).toBe('CONFIRMED');
    });

    it('расхождение суммы → FAIL, бронь НЕ подтверждается (регресс бага №5, PR #66)', async () => {
      const booking = await makeHeldBooking('bk-ct-4');
      const outSum = '1.00'; // ожидали 4000
      const invId = String(booking.id);

      const res = await postResult(outSum, invId, resultSig(outSum, invId));

      expect(res.text).toBe(`FAIL${invId}`);
      expect(await bookingStatus(booking.id)).toBe('HELD');
    });
  });

  // ─── Донаты ────────────────────────────────────────────────────────────────

  describe('donation webhook', () => {
    it('валидная подпись → OK + донат paid (read-after-write)', async () => {
      const donation = await prisma.donation.create({
        data: {
          amount: 500,
          status: 'pending',
          source: 'app',
          comment: DONATION_MARKER,
        },
      });
      const invId = String(DONATION_INVID_BASE + donation.id);
      const outSum = '500.00';

      const res = await postResult(outSum, invId, resultSig(outSum, invId));

      expect(res.text).toBe(`OK${invId}`);
      expect(await donationStatus(donation.id)).toBe('paid');
    });

    it('невалидная подпись → FAIL, донат остаётся pending', async () => {
      const donation = await prisma.donation.create({
        data: {
          amount: 500,
          status: 'pending',
          source: 'app',
          comment: DONATION_MARKER,
        },
      });
      const invId = String(DONATION_INVID_BASE + donation.id);

      const res = await postResult('500.00', invId, 'deadbeef');

      expect(res.text).toBe(`FAIL${invId}`);
      expect(await donationStatus(donation.id)).toBe('pending');
    });
  });

  // ─── Подписка: вебхук + capability-token (by-token/cancel) ────────────────

  describe('subscription webhook + capability-token', () => {
    it('валидная подпись → OK, подписка active, charge paid', async () => {
      const sub = await prisma.subscription.create({
        data: {
          status: 'pending',
          period: 'month',
          amount: 500,
          cancelToken: 'sub-ct-1',
        },
      });
      const charge = await prisma.subscriptionCharge.create({
        data: {
          subscriptionId: sub.id,
          amount: 500,
          status: 'pending',
          isFirst: true,
        },
      });
      const invId = String(SUBSCRIPTION_INVID_BASE + charge.id);
      const outSum = '500.00';

      const res = await postResult(outSum, invId, resultSig(outSum, invId));

      expect(res.text).toBe(`OK${invId}`);
      expect(await subscriptionStatus(sub.id)).toBe('active');
      expect(await chargeStatus(charge.id)).toBe('paid');
    });

    it('by-token отдаёт только allowlist-поля (без email/telegramId)', async () => {
      await prisma.subscription.create({
        data: {
          status: 'active',
          period: 'month',
          amount: 500,
          email: 'secret@e.co',
          telegramId: 777n,
          cancelToken: 'sub-ct-2',
        },
      });

      const res = await request(app.getHttpServer()).get(
        '/api/subscription/by-token/sub-ct-2',
      );

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(
        ['amount', 'nextChargeAt', 'period', 'status'].sort(),
      );
      expect(JSON.stringify(res.body)).not.toContain('secret@e.co');
      expect(JSON.stringify(res.body)).not.toContain('777');
    });

    it('cancel по своему токену переводит подписку в cancelled', async () => {
      const sub = await prisma.subscription.create({
        data: {
          status: 'active',
          period: 'month',
          amount: 500,
          cancelToken: 'sub-ct-3',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/subscription/cancel/sub-ct-3')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(await subscriptionStatus(sub.id)).toBe('cancelled');
    });

    it('чужой/битый токен → отказ на by-token и cancel', async () => {
      const byToken = await request(app.getHttpServer()).get(
        '/api/subscription/by-token/does-not-exist',
      );
      expect(byToken.status).toBe(404);

      const cancel = await request(app.getHttpServer())
        .post('/api/subscription/cancel/does-not-exist')
        .send({});
      expect(cancel.status).toBe(404);
    });
  });
});
