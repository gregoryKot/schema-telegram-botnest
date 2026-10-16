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
import { activeCronJobs, stopCronJobs } from './e2e-support/stop-cron-jobs';
import { DONATION_INVID_BASE } from '../src/donation/donation.service';
import { SUBSCRIPTION_INVID_BASE } from '../src/subscription/subscription.service';
import { markChargeFailed } from '../src/subscription/subscription.charge-failed';
import { chargeDue } from '../src/subscription/subscription.charges';
import { RobokassaService } from '../src/booking/robokassa.service';
import { BookingService } from '../src/booking/booking.service';
import { BookingNotifyService } from '../src/booking/booking-notify.service';
import { BookingConfirmRetryService } from '../src/booking/booking-confirm-retry.service';
import { MeetingService } from '../src/booking/meeting.service';
import { CalDavService } from '../src/booking/caldav.service';
import { bookingEventUid } from '../src/booking/booking-confirm-run';
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
  'bk-ct-10',
  'bk-ct-11',
  'bk-ct-12',
  'bk-ct-13',
  'bk-ct-14',
  'bk-ct-15',
  'bk-ct-16',
];
const SUBSCRIPTION_CANCEL_TOKENS = [
  'sub-ct-1',
  'sub-ct-2',
  'sub-ct-3',
  'sub-ct-4',
  'sub-ct-5',
  'sub-ct-6',
  'sub-ct-7',
  'sub-ct-8',
];
const DONATION_MARKER = 'e2e-payment-webhook-test';
const TEST_CLIENT_CONTACT = 't@e.co';
// Свой контакт у сценариев «эффекты подтверждения»: по нему из писем и DM
// отбираются сообщения именно этих броней (в карточке брони id нет), а чистка
// заодно убирает их ClientMeeting.
const EFFECTS_CLIENT_CONTACT = 'effects-21@e.co';
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
    // Настоящие @Cron после app.init() тикают посреди теста. Спек зовёт
    // крон-методы напрямую, а шпионы на notifyAdmin/почту считают вызовы
    // «ровно N»: тик sendReminders (*/5) на границе пятиминутки слал по броням
    // из общей БД джобы свои напоминания, и счётчик видел 4 вместо 1 (инцидент
    // CI 2026-10-16 03:35 UTC, PR #722). Останавливаем на весь файл — шпионы
    // стоят в нескольких describe.
    await stopCronJobs(app);
    // Чистый старт — на фейке no-op (свежий in-memory прогон), на реальном
    // Postgres вычищает фикстуры прошлого прогона этого же спека (см. комментарий
    // выше и cleanupPaymentFixtures в e2e-support/cleanup-fixtures.ts).
    await cleanupPaymentFixtures(prisma, {
      bookingCancelTokens: BOOKING_CANCEL_TOKENS,
      subscriptionCancelTokens: SUBSCRIPTION_CANCEL_TOKENS,
      donationMarker: DONATION_MARKER,
      clientContacts: [TEST_CLIENT_CONTACT, EFFECTS_CLIENT_CONTACT],
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

  it('настоящие кроны остановлены: вызовы шпионов считают только то, что зовёт сам тест', () => {
    expect(activeCronJobs(app)).toEqual([]);
  });

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
      // Как настоящий onConfirmed, довёл до конца — ставит флаг эффектов
      // (security#21): иначе повтор вебхука справедливо доделывал бы заново.
      onConfirmed = jest
        .spyOn(notify, 'onConfirmed')
        .mockImplementation(async (b) => {
          await prisma.booking.update({
            where: { id: b.id },
            data: { confirmEffectsDoneAt: new Date() },
          });
        });
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

  // ─── Побочные эффекты подтверждения доделываются (security#21) ────────────
  // CAS HELD→CONFIRMED прошёл, а эффекты (ссылка на встречу, календарь, DM)
  // упали — раньше бронь оставалась CONFIRMED без ссылки навсегда, а повтор
  // вебхука отвечал OK без эффектов. Здесь настоящий onConfirmed и настоящая
  // БД: падение вставляется на границе MeetingService.createMeeting (туда
  // уходят обрывы БД и Zoom), всё остальное — код прода. Фейк предикат
  // `confirmEffectsDoneAt: null` в updateMany не проверил бы так, как Postgres.

  describe('эффекты подтверждения: падение после CAS → повтор и крон доделывают', () => {
    let meetingSvc: MeetingService;
    let retry: BookingConfirmRetryService;
    let createMeeting: jest.SpyInstance;
    let tg: jest.SpyInstance;
    let mail: jest.SpyInstance;
    const pauseThrottle = () => new Promise((r) => setTimeout(r, 1100));

    beforeAll(async () => {
      await pauseThrottle();
      meetingSvc = app.get(MeetingService);
      retry = app.get(BookingConfirmRetryService);
      jest
        .spyOn(app.get(CronLeaderService), 'claimRun')
        .mockResolvedValue(true);
      tg = jest.spyOn(app.get(TelegramService), 'notifyAdmin');
      mail = jest.spyOn(app.get(EmailService), 'sendAdminNotification');
      // По умолчанию вызывает настоящий createMeeting (Jitsi + ClientMeeting).
      createMeeting = jest.spyOn(meetingSvc, 'createMeeting');
    });
    beforeEach(() => {
      tg.mockReset().mockResolvedValue(true);
      mail.mockReset().mockResolvedValue(undefined);
      createMeeting.mockClear();
    });
    afterAll(async () => {
      jest.restoreAllMocks();
      await pauseThrottle();
    });

    const row = (id: number) => prisma.booking.findUnique({ where: { id } });
    const texts = () => [
      ...tg.mock.calls.map((c) => String(c[0])),
      ...mail.mock.calls.map((c) => `${c[0]} | ${c[1]}`),
    ];
    // Только сообщения этих сценариев: по контакту клиента.
    const confirmedDms = () =>
      tg.mock.calls
        .map((c) => String(c[0]))
        .filter(
          (t) =>
            t.includes('Запись подтверждена') &&
            t.includes(EFFECTS_CLIENT_CONTACT),
        );
    const alerts = (id: number) =>
      tg.mock.calls
        .map((c) => String(c[0]))
        .filter((t) => t.includes(`#${id}`));
    const pay = (id: number) =>
      postResult(
        SESSION_OUT_SUM,
        String(id),
        resultSig(SESSION_OUT_SUM, String(id)),
      );
    function held(token: string) {
      return prisma.booking.create({
        data: {
          startsAt: new Date(Date.now() + 72 * 3_600_000),
          durationMin: 50,
          type: 'SESSION_50',
          status: 'HELD',
          heldUntil: new Date(Date.now() + 10 * 60_000),
          clientName: 'Клиент',
          clientContact: EFFECTS_CLIENT_CONTACT,
          cancelToken: token,
        },
      });
    }

    it('эффект упал после CAS → FAIL и честный алерт; повтор ResultURL: OK, ссылка и флаг есть, DM «подтверждена» ровно один', async () => {
      const b = await held('bk-ct-10');
      createMeeting.mockRejectedValueOnce(new Error("Can't reach database"));

      const first = await pay(b.id);

      expect(first.text).toBe(`FAIL${b.id}`); // Robokassa повторит
      const afterFirst = await row(b.id);
      expect(afterFirst?.status).toBe('CONFIRMED'); // CAS прошёл
      expect(afterFirst?.meetingUrl ?? null).toBeNull();
      expect(afterFirst?.confirmEffectsDoneAt ?? null).toBeNull();
      expect(afterFirst?.paidAt).toBeInstanceOf(Date);
      expect(confirmedDms()).toEqual([]);
      const alert = alerts(b.id).join('\n');
      expect(alert).toContain('оплачена и подтверждена');
      expect(alert).not.toContain('не подтвердилась'); // старая ложь
      await pauseThrottle();

      // Свежая строка: первый проход мог ещё идти — ретрай его не перебивает
      // (иначе вторая Zoom-встреча); OK отдаётся, доделает крон.
      createMeeting.mockClear();
      expect((await pay(b.id)).text).toBe(`OK${b.id}`);
      expect(createMeeting.mock.calls).toHaveLength(0);
      expect((await row(b.id))?.confirmEffectsDoneAt ?? null).toBeNull();
      await pauseThrottle();

      await prisma.booking.update({
        where: { id: b.id },
        data: { updatedAt: new Date(Date.now() - 5 * 60_000) },
      });
      const second = await pay(b.id); // ретрай Robokassa спустя время

      expect(second.text).toBe(`OK${b.id}`);
      const afterSecond = await row(b.id);
      expect(afterSecond?.status).toBe('CONFIRMED');
      expect(afterSecond?.meetingUrl).toBeTruthy();
      expect(afterSecond?.confirmEffectsDoneAt).toBeInstanceOf(Date);
      expect(confirmedDms()).toHaveLength(1);
      expect(
        mail.mock.calls
          .map((c) => String(c[1]))
          .filter((t) => t.includes(EFFECTS_CLIENT_CONTACT)),
      ).toHaveLength(1);
      // read-after-write: то, что видит клиент на странице «Оплачено».
      await pauseThrottle();
      const pub = await request(app.getHttpServer()).get(
        '/api/booking/by-token/bk-ct-10',
      );
      expect(pub.status).toBe(200);
      expect(pub.body.meetingUrl).toMatch(/^https:\/\//);
    });

    it('контроль: повтор по полностью подтверждённой брони — OK, ничего не шлёт и встречу заново не создаёт', async () => {
      await pauseThrottle();
      const b = await held('bk-ct-11');
      expect((await pay(b.id)).text).toBe(`OK${b.id}`);
      const done = await row(b.id);
      expect(done?.confirmEffectsDoneAt).toBeInstanceOf(Date);
      expect(confirmedDms()).toHaveLength(1);
      tg.mockClear();
      mail.mockClear();
      createMeeting.mockClear();

      expect((await pay(b.id)).text).toBe(`OK${b.id}`);

      expect(texts()).toEqual([]);
      expect(createMeeting.mock.calls).toHaveLength(0);
      const again = await row(b.id);
      expect(again?.confirmEffectsDoneAt?.getTime()).toBe(
        done?.confirmEffectsDoneAt?.getTime(),
      );
      expect(again?.meetingUrl).toBe(done?.meetingUrl);
    });

    it('гибель процесса: ретрая вебхука нет — крон-добор доделывает зависшую бронь, свежую не трогает', async () => {
      await pauseThrottle();
      const b = await held('bk-ct-12');
      createMeeting.mockRejectedValueOnce(new Error('SIGTERM'));
      expect((await pay(b.id)).text).toBe(`FAIL${b.id}`);
      createMeeting.mockClear();

      await retry.retryStalled(); // строка только что писана — ещё не «зависла»

      expect(createMeeting.mock.calls).toHaveLength(0);
      expect((await row(b.id))?.meetingUrl ?? null).toBeNull();

      await prisma.booking.update({
        where: { id: b.id },
        data: { updatedAt: new Date(Date.now() - 10 * 60_000) },
      });
      await retry.retryStalled();

      const done = await row(b.id);
      expect(done?.meetingUrl).toBeTruthy();
      expect(done?.confirmEffectsDoneAt).toBeInstanceOf(Date);
      expect(confirmedDms()).toHaveLength(1);

      tg.mockClear();
      mail.mockClear();
      await retry.retryStalled(); // второй тик: доделанное не берётся
      expect(
        tg.mock.calls.filter((c) =>
          String(c[0]).includes(EFFECTS_CLIENT_CONTACT),
        ),
      ).toEqual([]);
    });
  });

  // ─── Календарь: событие не переживает отмену (аудит 2026-10-11, booking-cas) ─
  // Граница подмены — CalDavService (PUT/DELETE в iCloud): фейковый календарь —
  // множество uid. Всё выше (HTTP ResultURL с MD5-подписью, runConfirmEffects,
  // claimCancel, onCancelled) — код прода на настоящей БД. Гонка confirm ‖ cancel
  // — свойство Postgres (CAS по строке), мок count её не доказал бы (правило №18).

  describe('календарь: confirm ‖ cancel и гибель пода между PUT и записью uid', () => {
    let bookingSvc: BookingService;
    let tg: jest.SpyInstance;
    let mail: jest.SpyInstance;
    let push: jest.SpyInstance;
    let remove: jest.SpyInstance;
    let calendar: Set<string>;
    let onPush: ((uid: string) => Promise<void>) | null;
    const pauseThrottle = () => new Promise((r) => setTimeout(r, 1100));

    beforeAll(async () => {
      await pauseThrottle();
      bookingSvc = app.get(BookingService);
      jest
        .spyOn(app.get(CronLeaderService), 'claimRun')
        .mockResolvedValue(true);
      tg = jest.spyOn(app.get(TelegramService), 'notifyAdmin');
      mail = jest.spyOn(app.get(EmailService), 'sendAdminNotification');
      const cal = app.get(CalDavService);
      push = jest.spyOn(cal, 'pushEvent');
      remove = jest.spyOn(cal, 'removeEvent');
    });
    beforeEach(() => {
      calendar = new Set();
      onPush = null;
      tg.mockReset().mockResolvedValue(true);
      mail.mockReset().mockResolvedValue(undefined);
      push.mockReset().mockImplementation(async (ev: { uid: string }) => {
        // Отмена приходит, пока идёт PUT: она раньше события в календаре.
        if (onPush) await onPush(ev.uid);
        calendar.add(ev.uid);
        return ev.uid;
      });
      remove.mockReset().mockImplementation(async (uid: string) => {
        calendar.delete(uid);
      });
    });
    afterAll(async () => {
      jest.restoreAllMocks();
      await pauseThrottle();
    });

    const row = (id: number) => prisma.booking.findUnique({ where: { id } });
    const dms = (title: string) =>
      tg.mock.calls
        .map((c) => String(c[0]))
        .filter((t) => t.includes(title) && t.includes(EFFECTS_CLIENT_CONTACT));
    function create(token: string, status: 'HELD' | 'CONFIRMED') {
      return prisma.booking.create({
        data: {
          startsAt: new Date(Date.now() + 72 * 3_600_000),
          durationMin: 50,
          type: 'SESSION_50',
          status,
          heldUntil: status === 'HELD' ? new Date(Date.now() + 600_000) : null,
          clientName: 'Клиент',
          clientContact: EFFECTS_CLIENT_CONTACT,
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

    it('отмена во время PUT: события в календаре не остаётся, «Запись подтверждена» не уходит', async () => {
      await pauseThrottle();
      const b = await create('bk-ct-13', 'HELD');
      onPush = async () => {
        await bookingSvc.cancel('bk-ct-13');
      };

      const res = await pay(b.id);

      expect(res.text).toBe(`OK${b.id}`);
      expect((await row(b.id))?.status).toBe('CANCELLED');
      expect([...calendar]).toEqual([]); // DELETE отмены обогнал PUT, добил confirm
      expect(remove).toHaveBeenCalledWith(bookingEventUid(b.id));
      expect(dms('Запись подтверждена')).toEqual([]);
      expect(dms('Запись отменена')).toHaveLength(1);
      expect((await row(b.id))?.confirmEffectsDoneAt ?? null).toBeNull();
    });

    it('под умер между PUT и записью uid: CONFIRMED без calDavUid, событие уже в календаре — отмена его снимает', async () => {
      const b = await create('bk-ct-14', 'CONFIRMED');
      calendar.add(bookingEventUid(b.id)); // PUT прошёл, uid в строку не записан
      expect((await row(b.id))?.calDavUid ?? null).toBeNull();

      await expect(bookingSvc.cancel('bk-ct-14')).resolves.toEqual({
        ok: true,
      });

      expect([...calendar]).toEqual([]);
      expect(dms('Запись отменена')).toHaveLength(1);
    });

    it('отмена HELD-брони: события не было, DELETE в календарь не уходит, админ уведомлён', async () => {
      const b = await create('bk-ct-16', 'HELD');

      await bookingSvc.cancel('bk-ct-16');

      expect((await row(b.id))?.status).toBe('CANCELLED');
      expect(remove).not.toHaveBeenCalled();
      expect(dms('Запись отменена')).toHaveLength(1);
    });

    it('контроль: обычный порядок (оплата завершилась, потом отмена) — DELETE по записанному uid', async () => {
      await pauseThrottle();
      const b = await create('bk-ct-15', 'HELD');
      expect((await pay(b.id)).text).toBe(`OK${b.id}`);
      const saved = (await row(b.id))?.calDavUid;
      expect(saved).toBe(bookingEventUid(b.id));
      expect([...calendar]).toEqual([saved]);
      expect(dms('Запись подтверждена')).toHaveLength(1);

      await bookingSvc.cancel('bk-ct-15');

      expect([...calendar]).toEqual([]);
      expect(remove).toHaveBeenCalledWith(saved);
      expect(dms('Запись отменена')).toHaveLength(1);
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

    // Аудит 2026-10, security#17: оплата после отмены не воскрешает подписку.
    // Предикат `status in` в одной транзакции с charge проверяет драйвер на
    // живом Postgres, а не мок; письма/DM владельцу ловятся шпионами.
    describe('оплата после отмены', () => {
      let tg: jest.SpyInstance;
      let mail: jest.SpyInstance;
      beforeAll(async () => {
        await new Promise((r) => setTimeout(r, 1100)); // окно throttler
        tg = jest.spyOn(app.get(TelegramService), 'notifyAdmin');
        mail = jest.spyOn(app.get(EmailService), 'sendAdminNotification');
      });
      beforeEach(() => {
        tg.mockReset().mockResolvedValue(true);
        mail.mockReset().mockResolvedValue(undefined);
      });
      afterAll(() => {
        tg.mockRestore();
        mail.mockRestore();
      });

      async function seed(status: string, token: string, extra = {}) {
        const sub = await prisma.subscription.create({
          data: {
            status,
            period: 'month',
            amount: 500,
            cancelToken: token,
            firstInvId: 900001,
            nextChargeAt: new Date(Date.now() + 86_400_000),
            ...extra,
          },
        });
        const charge = await prisma.subscriptionCharge.create({
          data: { subscriptionId: sub.id, amount: 500, status: 'pending' },
        });
        const invId = String(SUBSCRIPTION_INVID_BASE + charge.id);
        return { sub, charge, invId };
      }
      const payInv = (invId: string) =>
        postResult('500.00', invId, resultSig('500.00', invId));
      const subRow = (id: number) =>
        prisma.subscription.findUnique({ where: { id } });

      it('active + pending-charge → cancel → ResultURL: OK, подписка cancelled, charge paid, сигнал в оба канала', async () => {
        const { sub, charge, invId } = await seed('active', 'sub-ct-4');
        const cancel = await request(app.getHttpServer())
          .post('/api/subscription/cancel/sub-ct-4')
          .send({});
        expect(cancel.status).toBe(200);

        const res = await payInv(invId);

        expect(res.text).toBe(`OK${invId}`);
        const row = await subRow(sub.id);
        expect(row?.status).toBe('cancelled');
        expect(row?.nextChargeAt).toBeNull();
        expect(await chargeStatus(charge.id)).toBe('paid');
        expect(tg).toHaveBeenCalledTimes(1);
        expect(mail).toHaveBeenCalledTimes(1);
        expect(String(tg.mock.calls[0][0])).toContain(`#${sub.id}`);
        expect(String(tg.mock.calls[0][0])).toContain('Верните деньги');

        // Повтор вебхука Robokassa: тот же OK, второго сигнала нет.
        await payInv(invId);
        expect(tg).toHaveBeenCalledTimes(1);
        expect(mail).toHaveBeenCalledTimes(1);
      });

      it('КОНТРОЛЬ: past_due + ResultURL → active, счётчик сбоев обнулён, без сигнала «после отмены»', async () => {
        const { sub, charge, invId } = await seed('past_due', 'sub-ct-5', {
          failedAttempts: 3,
          nextChargeAt: null,
        });

        const res = await payInv(invId);

        expect(res.text).toBe(`OK${invId}`);
        const row = await subRow(sub.id);
        expect(row?.status).toBe('active');
        expect(row?.failedAttempts).toBe(0);
        expect(row?.nextChargeAt).toBeInstanceOf(Date);
        expect(await chargeStatus(charge.id)).toBe('paid');
        const texts = tg.mock.calls.map((c) => String(c[0])).join('\n');
        expect(texts).not.toContain('Верните деньги');
      });

      // Сбой списания против вебхука оплаты: транзакция на живом Postgres решает
      // по count пометки charge. Оплата пришла раньше — подписку не трогаем
      // (nextChargeAt от вебхука), иначе ретрай через сутки = второе списание.
      it('вебхук оплатил charge раньше сбоя: markChargeFailed не засчитывает сбой, подписка не тронута', async () => {
        const { sub, charge, invId } = await seed('active', 'sub-ct-6');
        expect((await payInv(invId)).text).toBe(`OK${invId}`);
        const before = await subRow(sub.id);

        const counted = await markChargeFailed(prisma, {
          chargeId: charge.id,
          subId: sub.id,
          status: 'active',
          fails: 1,
          maxFails: 3,
        });

        expect(counted).toBe(false);
        expect(await chargeStatus(charge.id)).toBe('paid');
        const after = await subRow(sub.id);
        expect(after?.failedAttempts).toBe(0);
        expect(after?.nextChargeAt).toEqual(before?.nextChargeAt);
      });

      // Тот же шов, но через настоящий chargeDue: граница подменена только на
      // chargeRecurring (Robokassa) — пока «банк» отвечает отказом, приходит
      // настоящий вебхук оплаты этого же charge. Прямой вызов markChargeFailed
      // выше не заметит, если chargeDue вернёт старую batch-транзакцию.
      // chargeDue берёт захват подписки сырым SQL — фейк его не эмулирует.
      (process.env.E2E_REAL_DB === '1' ? it : it.skip)(
        'chargeDue: вебхук оплатил charge, пока Robokassa отвечала отказом → сбой не засчитан, nextChargeAt от вебхука цел, алерта нет',
        async () => {
          const sub = await prisma.subscription.create({
            data: {
              status: 'active',
              period: 'month',
              amount: 500,
              cancelToken: 'sub-ct-8',
              firstInvId: 900001,
              nextChargeAt: new Date(Date.now() - 60_000),
            },
          });
          const robokassa = {
            enabled: true,
            chargeRecurring: async ({ invId }: { invId: number }) => {
              const inv = String(invId);
              expect((await payInv(inv)).text).toBe(`OK${inv}`);
              return { ok: false, body: 'bank declined' };
            },
          } as unknown as RobokassaService;

          await chargeDue({
            prisma,
            robokassa,
            notify: app.get(BookingNotifyService),
            logger: new Logger('test'),
            enabled: true,
          });

          const charge = await prisma.subscriptionCharge.findFirst({
            where: { subscriptionId: sub.id },
          });
          expect(charge?.status).toBe('paid');
          const row = await subRow(sub.id);
          expect(row?.failedAttempts).toBe(0);
          expect(row?.status).toBe('active');
          // Вебхук поставил nextChargeAt на период вперёд; ретрай «через
          // сутки» затёр бы его и дал второе списание.
          expect(row?.nextChargeAt?.getTime()).toBeGreaterThan(
            Date.now() + 20 * 86_400_000,
          );
          const texts = tg.mock.calls.map((c) => String(c[0])).join('\n');
          expect(texts).not.toContain('Не удалось списать');
        },
      );

      it('КОНТРОЛЬ: charge ещё pending → сбой засчитан, charge failed, ретрай через сутки', async () => {
        const { sub, charge } = await seed('active', 'sub-ct-7');

        const counted = await markChargeFailed(prisma, {
          chargeId: charge.id,
          subId: sub.id,
          status: 'active',
          fails: 1,
          maxFails: 3,
        });

        expect(counted).toBe(true);
        expect(await chargeStatus(charge.id)).toBe('failed');
        const row = await subRow(sub.id);
        expect(row?.failedAttempts).toBe(1);
        expect(row?.status).toBe('active');
        expect(row?.nextChargeAt?.getTime()).toBeGreaterThan(Date.now());
      });
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
