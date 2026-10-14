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
import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { SessionType } from '@prisma/client';
import { SESSION_DEFAULT_PRICE } from '../src/booking/booking.config';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupPaymentFixtures } from './e2e-support/cleanup-fixtures';
import { DONATION_INVID_BASE } from '../src/donation/donation.service';
import { SUBSCRIPTION_INVID_BASE } from '../src/subscription/subscription.service';
import { BookingService } from '../src/booking/booking.service';
import { BookingNotifyService } from '../src/booking/booking-notify.service';
import { CronLeaderService } from '../src/infra/cron-leader.service';
import { TelegramService } from '../src/telegram/telegram.service';
import { EmailService } from '../src/auth/email.service';

function md5(s: string): string {
  return createHash('md5').update(s, 'utf8').digest('hex');
}

// Идентификаторы фикстур этого спека (TEST_TRUST_PLAN.md, п.1) — на реальном
// Postgres спек гоняется трижды подряд на одной БД (проверка идемпотентности
// вебхука), поэтому чистка в beforeAll обязана знать точные токены/маркер,
// иначе второй прогон падает на unique-констрейнте cancelToken.
const BOOKING_CANCEL_TOKENS = [
  'bk-ct-1',
  'bk-ct-2',
  'bk-ct-3',
  'bk-ct-4',
  'bk-ct-5',
  'bk-ct-6',
  'bk-ct-7',
  'bk-ct-8',
  'bk-ct-9',
];
const SUBSCRIPTION_CANCEL_TOKENS = ['sub-ct-1', 'sub-ct-2', 'sub-ct-3'];
const DONATION_MARKER = 'e2e-payment-webhook-test';
const TEST_CLIENT_CONTACT = 't@e.co';
// Цена сессии 50 минут — из конфига, не литералом: на фейке PricingService
// отдаёт дефолт, а на реальном Postgres — строку BookingSetting
// price:SESSION_50, которую заводит миграция 20261001090000_session_price_3000
// (равна дефолту). Литерал «4000.00» не пережил бы смену цены.
const SESSION_OUT_SUM = `${SESSION_DEFAULT_PRICE[SessionType.SESSION_50]}.00`;

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
        type: 'SESSION_50', // цена — SESSION_DEFAULT_PRICE, см. SESSION_OUT_SUM
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
      const outSum = SESSION_OUT_SUM;
      const invId = String(booking.id);

      const res = await postResult(outSum, invId, resultSig(outSum, invId));

      expect(res.status).toBe(200);
      expect(res.text).toBe(`OK${invId}`);
      expect(await bookingStatus(booking.id)).toBe('CONFIRMED');
    });

    it('невалидная подпись → FAIL, бронь остаётся HELD (состояние не изменилось)', async () => {
      const booking = await makeHeldBooking('bk-ct-2');
      const invId = String(booking.id);

      const res = await postResult(SESSION_OUT_SUM, invId, 'deadbeef');

      expect(res.text).toBe(`FAIL${invId}`);
      expect(await bookingStatus(booking.id)).toBe('HELD');
    });

    it('идемпотентный повтор того же уведомления → OK, без дублей', async () => {
      const booking = await makeHeldBooking('bk-ct-3');
      const outSum = SESSION_OUT_SUM;
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
      const outSum = '1.00'; // ожидали цену сессии (SESSION_OUT_SUM)
      const invId = String(booking.id);

      const res = await postResult(outSum, invId, resultSig(outSum, invId));

      expect(res.text).toBe(`FAIL${invId}`);
      expect(await bookingStatus(booking.id)).toBe('HELD');
    });
  });

  // ─── Оплата после истечения холда / отмены (аудит 2026-10-11, P1 + P2) ────
  // Раньше ResultURL по CANCELLED-брони получал `OK` и одну строку warn: деньги
  // списаны, брони нет, владелец не знает (а перед этим ему ушло ложное «истекла
  // без оплаты»). Тот же класс — переходы статуса без предиката в WHERE:
  // expireHolds перекрашивал оплаченную бронь, N параллельных cancel() давали
  // N× уведомлений. Сценарии идут по HTTP через настоящий AppModule, на живом
  // Postgres (джоба migrations) — мок prisma предикат WHERE не проверяет.

  describe('оплата по отменённой/истёкшей брони и CAS-переходы статуса', () => {
    let bookingSvc: BookingService;
    let notify: BookingNotifyService;
    let tg: jest.SpyInstance;
    let mail: jest.SpyInstance;
    let onConfirmed: jest.SpyInstance;
    let onCancelled: jest.SpyInstance;
    let notifyExpired: jest.SpyInstance;

    // Общий throttler приложения — 10 запросов в секунду на IP; сценарии ниже
    // шлют вебхуки подряд, поэтому окно переждано до и после блока.
    const pauseThrottle = () => new Promise((r) => setTimeout(r, 1100));

    beforeAll(async () => {
      await pauseThrottle();
      bookingSvc = app.get(BookingService);
      notify = app.get(BookingNotifyService);
      // Аренда крона — отдельный живой спек (cron-leader.e2e-spec.ts); здесь
      // тик нужен безусловно, без чистки CronLease между сценариями.
      jest
        .spyOn(app.get(CronLeaderService), 'claimRun')
        .mockResolvedValue(true);
      tg = jest.spyOn(app.get(TelegramService), 'notifyAdmin');
      mail = jest.spyOn(app.get(EmailService), 'sendAdminNotification');
      // Побочные эффекты брони (Zoom/CalDAV) наружу не ходят; считаем вызовы.
      onConfirmed = jest.spyOn(notify, 'onConfirmed').mockResolvedValue();
      onCancelled = jest.spyOn(notify, 'onCancelled').mockResolvedValue();
      notifyExpired = jest.spyOn(notify, 'notifyExpired');
    });
    beforeEach(() => {
      tg.mockReset().mockResolvedValue(true);
      mail.mockReset().mockResolvedValue(undefined);
      onConfirmed.mockClear();
      onCancelled.mockClear();
      notifyExpired.mockClear();
    });
    afterAll(async () => {
      jest.restoreAllMocks();
      await pauseThrottle();
    });

    const adminTexts = () => [
      ...tg.mock.calls.map((c) => String(c[0])),
      ...mail.mock.calls.map((c) => `${c[0]} | ${c[1]}`),
    ];
    const paidAt = async (id: number) =>
      (await prisma.booking.findUnique({ where: { id } }))?.paidAt;

    // Бронь HELD с холдом в прошлом (для expireHolds) либо в будущем.
    function held(token: string, heldUntil: Date, startsInHours = 72) {
      return prisma.booking.create({
        data: {
          startsAt: new Date(Date.now() + startsInHours * 3_600_000),
          durationMin: 50,
          type: 'SESSION_50',
          status: 'HELD',
          heldUntil,
          clientName: 'Клиент',
          clientContact: TEST_CLIENT_CONTACT,
          cancelToken: token,
        },
      });
    }
    const pay = (id: number) =>
      postResult(
        SESSION_OUT_SUM,
        String(id),
        resultSig(SESSION_OUT_SUM, String(id)),
      );

    it('холд истёк → ResultURL: ответ OK, статус CANCELLED, paidAt записан, владельцу «деньги получены, а брони нет» в оба канала', async () => {
      const b = await held('bk-ct-5', new Date(Date.now() - 60_000));
      await bookingSvc.expireHolds();
      expect(await bookingStatus(b.id)).toBe('CANCELLED');
      expect(await paidAt(b.id)).toBeFalsy(); // null на Postgres, undefined на фейке
      tg.mockClear();
      mail.mockClear();
      const warn = jest.spyOn(Logger.prototype, 'warn');
      const error = jest.spyOn(Logger.prototype, 'error');

      const res = await pay(b.id);

      expect(res.status).toBe(200);
      expect(res.text).toBe(`OK${b.id}`); // деньги получены — повтор вебхука не поможет
      expect(await bookingStatus(b.id)).toBe('CANCELLED'); // не воскрешаем: слот мог уйти
      expect(await paidAt(b.id)).toBeInstanceOf(Date);
      expect(onConfirmed).not.toHaveBeenCalled();
      expect(tg).toHaveBeenCalledTimes(1);
      expect(mail).toHaveBeenCalledTimes(1);
      expect(adminTexts().join('\n')).toContain(`#${b.id}`);
      expect(adminTexts().join('\n')).toContain('Деньги получены');
      expect(adminTexts().join('\n')).toContain('Верните деньги');
      // error-лог ушёл бы владельцу вторым DM через AlertLogger.
      expect(error).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('after cancel'),
      );
      warn.mockRestore();
      error.mockRestore();
    });

    it('клиент отменил, потом оплатил по старой ссылке → то же: OK, paidAt, алерт в оба канала', async () => {
      const b = await held('bk-ct-6', new Date(Date.now() + 10 * 60_000));
      await bookingSvc.cancel('bk-ct-6');
      expect(await bookingStatus(b.id)).toBe('CANCELLED');
      tg.mockClear();
      mail.mockClear();

      const res = await pay(b.id);

      expect(res.text).toBe(`OK${b.id}`);
      expect(await bookingStatus(b.id)).toBe('CANCELLED');
      expect(await paidAt(b.id)).toBeInstanceOf(Date);
      expect(tg).toHaveBeenCalledTimes(1);
      expect(mail).toHaveBeenCalledTimes(1);
    });

    it('контроль: обычная оплата ставит paidAt, а повтор по CONFIRMED — OK без алерта и без смены paidAt', async () => {
      const b = await held('bk-ct-7', new Date(Date.now() + 10 * 60_000));
      expect((await pay(b.id)).text).toBe(`OK${b.id}`);
      const first = await paidAt(b.id);
      expect(first).toBeInstanceOf(Date);
      expect(onConfirmed).toHaveBeenCalledTimes(1);
      tg.mockClear();
      mail.mockClear();

      expect((await pay(b.id)).text).toBe(`OK${b.id}`);

      expect(adminTexts()).toEqual([]);
      expect((await paidAt(b.id))?.getTime()).toBe(first?.getTime());
      expect(onConfirmed).toHaveBeenCalledTimes(1);
    });

    it('вебхук между findMany и CAS крона: бронь остаётся CONFIRMED, «истекла без оплаты» по ней не уходит', async () => {
      const b = await held('bk-ct-8', new Date(Date.now() - 1_000));
      // Перехват: крон уже прочитал снимок HELD-кандидатов, и в этот момент
      // приходит настоящий ResultURL (HTTP) и выигрывает CAS HELD→CONFIRMED.
      // Подмена присваиванием, а не jest.spyOn: на фейке findMany уже jest.fn.
      const realFindMany = prisma.booking.findMany;
      let webhookReply = '';
      prisma.booking.findMany = async (args: never) => {
        const rows = await realFindMany.call(prisma.booking, args);
        if (!webhookReply) {
          webhookReply = 'pending';
          webhookReply = (await pay(b.id)).text;
        }
        return rows;
      };
      try {
        await bookingSvc.expireHolds();
      } finally {
        prisma.booking.findMany = realFindMany;
      }

      expect(webhookReply).toBe(`OK${b.id}`);
      expect(await bookingStatus(b.id)).toBe('CONFIRMED');
      expect(await paidAt(b.id)).toBeInstanceOf(Date);
      const notified = notifyExpired.mock.calls.flatMap((c) =>
        (c[0] as { id: number }[]).map((x) => x.id),
      );
      expect(notified).not.toContain(b.id);
      expect(adminTexts().join('\n')).not.toContain('истекла без оплаты');
    });

    it('пять одновременных отмен по одному токену → побочные эффекты один раз', async () => {
      const b = await held('bk-ct-9', new Date(Date.now() + 10 * 60_000));

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => bookingSvc.cancel('bk-ct-9')),
      );

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(onCancelled).toHaveBeenCalledTimes(1); // DM+письмо+DELETE в CalDAV — один раз
      expect(await bookingStatus(b.id)).toBe('CANCELLED');
      // повторная отмена позже — тоже no-op
      await expect(bookingSvc.cancel('bk-ct-9')).resolves.toEqual({ ok: true });
      expect(onCancelled).toHaveBeenCalledTimes(1);
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
