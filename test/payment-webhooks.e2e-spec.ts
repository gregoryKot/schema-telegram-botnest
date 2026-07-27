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
import { DONATION_INVID_BASE } from '../src/donation/donation.service';
import { SUBSCRIPTION_INVID_BASE } from '../src/subscription/subscription.service';

function md5(s: string): string {
  return createHash('md5').update(s, 'utf8').digest('hex');
}

describe('e2e smoke: платёжный контур Robokassa по HTTP', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const PASS2 = process.env.ROBOKASSA_PASSWORD2 as string;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

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
        clientContact: 't@e.co',
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
      expect(
        prisma.booking._rows.find((r) => r.id === booking.id)?.status,
      ).toBe('CONFIRMED');
    });

    it('невалидная подпись → FAIL, бронь остаётся HELD (состояние не изменилось)', async () => {
      const booking = await makeHeldBooking('bk-ct-2');
      const invId = String(booking.id);

      const res = await postResult('4000.00', invId, 'deadbeef');

      expect(res.text).toBe(`FAIL${invId}`);
      expect(
        prisma.booking._rows.find((r) => r.id === booking.id)?.status,
      ).toBe('HELD');
    });

    it('идемпотентный повтор того же уведомления → OK, без дублей', async () => {
      const booking = await makeHeldBooking('bk-ct-3');
      const outSum = '4000.00';
      const invId = String(booking.id);
      const sig = resultSig(outSum, invId);

      const first = await postResult(outSum, invId, sig);
      expect(first.text).toBe(`OK${invId}`);
      const rowsAfterFirst = prisma.booking._rows.length;

      const second = await postResult(outSum, invId, sig);
      expect(second.status).toBe(200);
      expect(second.text).toBe(`OK${invId}`);
      expect(prisma.booking._rows.length).toBe(rowsAfterFirst); // без дублей
      expect(
        prisma.booking._rows.find((r) => r.id === booking.id)?.status,
      ).toBe('CONFIRMED');
    });

    it('расхождение суммы → FAIL, бронь НЕ подтверждается (регресс бага №5, PR #66)', async () => {
      const booking = await makeHeldBooking('bk-ct-4');
      const outSum = '1.00'; // ожидали 4000
      const invId = String(booking.id);

      const res = await postResult(outSum, invId, resultSig(outSum, invId));

      expect(res.text).toBe(`FAIL${invId}`);
      expect(
        prisma.booking._rows.find((r) => r.id === booking.id)?.status,
      ).toBe('HELD');
    });
  });

  // ─── Донаты ────────────────────────────────────────────────────────────────

  describe('donation webhook', () => {
    it('валидная подпись → OK + донат paid (read-after-write)', async () => {
      const donation = await prisma.donation.create({
        data: { amount: 500, status: 'pending', source: 'app' },
      });
      const invId = String(DONATION_INVID_BASE + donation.id);
      const outSum = '500.00';

      const res = await postResult(outSum, invId, resultSig(outSum, invId));

      expect(res.text).toBe(`OK${invId}`);
      expect(
        prisma.donation._rows.find((r) => r.id === donation.id)?.status,
      ).toBe('paid');
    });

    it('невалидная подпись → FAIL, донат остаётся pending', async () => {
      const donation = await prisma.donation.create({
        data: { amount: 500, status: 'pending', source: 'app' },
      });
      const invId = String(DONATION_INVID_BASE + donation.id);

      const res = await postResult('500.00', invId, 'deadbeef');

      expect(res.text).toBe(`FAIL${invId}`);
      expect(
        prisma.donation._rows.find((r) => r.id === donation.id)?.status,
      ).toBe('pending');
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
      expect(
        prisma.subscription._rows.find((r) => r.id === sub.id)?.status,
      ).toBe('active');
      expect(
        prisma.subscriptionCharge._rows.find((r) => r.id === charge.id)?.status,
      ).toBe('paid');
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
      expect(
        prisma.subscription._rows.find((r) => r.id === sub.id)?.status,
      ).toBe('cancelled');
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
