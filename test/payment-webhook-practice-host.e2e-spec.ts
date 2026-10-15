// Аудит 2026-10, security#16: вебхук Robokassa (ResultURL) и возвраты
// Success/Fail приходят на kotlarewski.gr — хост визитки. С #605 (2026-10-03)
// practiceDomainMiddleware стоит на всех методах и отвечал 301 на всё, чего нет
// в allow-list, а `/api/payment` там не было: POST терял тело, бронь оставалась
// HELD при списанных деньгах. practice-domain.middleware.spec.ts проверяет
// вердикт функции на моке req; здесь — шов целиком (правило №14): настоящий
// AppModule, настоящий body-parser, POST формой application/x-www-form-urlencoded
// (так шлёт Robokassa) и явный Host (правило №19: запрос без Host — запрос
// ниоткуда).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { SessionType } from '@prisma/client';
import { SESSION_DEFAULT_PRICE } from '../src/booking/booking.config';
import { completeCheckout } from '../src/booking/booking.checkout';
import { RobokassaService } from '../src/booking/robokassa.service';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupPaymentFixtures } from './e2e-support/cleanup-fixtures';

const md5 = (s: string): string =>
  createHash('md5').update(s, 'utf8').digest('hex');

const PRACTICE = 'kotlarewski.gr';
const CANONICAL = 'schemehappens.ru';
const OUT_SUM = `${SESSION_DEFAULT_PRICE[SessionType.SESSION_50]}.00`;
// Токены фикстур — для чистки перед повторным прогоном на одной живой БД.
const TOKENS = ['ph-ct-1', 'ph-ct-2', 'ph-ct-3', 'ph-ct-4', 'ph-ct-5'];
const CONTACT = 't@e.co';

describe('e2e: платёжный контур Robokassa на хосте визитки (kotlarewski.gr)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const PASS1 = process.env.ROBOKASSA_PASSWORD1 as string;
  const PASS2 = process.env.ROBOKASSA_PASSWORD2 as string;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupPaymentFixtures(prisma, {
      bookingCancelTokens: TOKENS,
      subscriptionCancelTokens: [],
      donationMarker: 'e2e-payment-practice-host',
      clientContacts: [CONTACT],
    });
  });
  afterAll(async () => {
    await app.close();
  });

  const held = (cancelToken: string) =>
    prisma.booking.create({
      data: {
        startsAt: new Date(Date.now() + 3_600_000),
        durationMin: 50,
        type: 'SESSION_50',
        status: 'HELD',
        heldUntil: new Date(Date.now() + 15 * 60_000),
        clientName: 'Клиент',
        clientContact: CONTACT,
        cancelToken,
        // Сумма счёта, как её кладёт book(): completeCheckout платит по ней.
        amount: SESSION_DEFAULT_PRICE[SessionType.SESSION_50],
      },
    });
  const statusOf = async (id: number) =>
    (await prisma.booking.findUnique({ where: { id } }))?.status;

  // Форма, не JSON: именно так Robokassa доставляет ResultURL.
  const postResult = (host: string, invId: string, sig: string) =>
    request(app.getHttpServer())
      .post('/api/payment/result')
      .set('Host', host)
      .type('form')
      .send({ OutSum: OUT_SUM, InvId: invId, SignatureValue: sig });

  it('POST формой на kotlarewski.gr → 200 OK<InvId>, бронь CONFIRMED (read-after-write)', async () => {
    const b = await held('ph-ct-1');
    const invId = String(b.id);
    const res = await postResult(
      PRACTICE,
      invId,
      md5(`${OUT_SUM}:${invId}:${PASS2}`),
    );

    expect(res.status).toBe(200);
    expect(res.text).toBe(`OK${invId}`);
    expect(await statusOf(b.id)).toBe('CONFIRMED');
  });

  it('контроль: тот же POST на schemehappens.ru даёт тот же результат', async () => {
    const b = await held('ph-ct-2');
    const invId = String(b.id);
    const res = await postResult(
      CANONICAL,
      invId,
      md5(`${OUT_SUM}:${invId}:${PASS2}`),
    );

    expect(res.status).toBe(200);
    expect(res.text).toBe(`OK${invId}`);
    expect(await statusOf(b.id)).toBe('CONFIRMED');
  });

  it('неверная подпись на kotlarewski.gr доходит до контроллера: FAIL, а не 301, бронь HELD', async () => {
    const b = await held('ph-ct-3');
    const invId = String(b.id);
    const res = await postResult(PRACTICE, invId, 'deadbeef');

    expect(res.status).toBe(200);
    expect(res.text).toBe(`FAIL${invId}`);
    expect(await statusOf(b.id)).toBe('HELD');
  });

  it('SuccessURL/FailURL с алиаса: 302 на /booking/paid алиаса, без 301 на каноническом хосте', async () => {
    const b = await held('ph-ct-4');
    const invId = String(b.id);
    const qs = `InvId=${invId}&OutSum=${OUT_SUM}&SignatureValue=${md5(`${OUT_SUM}:${invId}:${PASS1}`)}`;

    const success = await request(app.getHttpServer())
      .get(`/api/payment/success?${qs}`)
      .set('Host', PRACTICE);
    expect(success.status).toBe(302);
    expect(success.headers.location).toBe(
      `https://${PRACTICE}/booking/paid?token=ph-ct-4`,
    );

    const fail = await request(app.getHttpServer())
      .get(`/api/payment/fail?InvId=${invId}`)
      .set('Host', PRACTICE);
    expect(fail.status).toBe(302);
    expect(fail.headers.location).toBe(
      `https://${PRACTICE}/booking/paid?fail=1`,
    );
  });

  it('адреса, которые код сам отдаёт Robokassa (completeCheckout), проходят middleware алиаса', async () => {
    const robokassa = app.get(RobokassaService);
    const b = await held('ph-ct-5');
    const deps = {
      prisma,
      robokassa,
      // Хост берём как в проде по умолчанию (SITE_URL не задан).
      siteUrl: `https://${PRACTICE}`,
      notify: { onAwaitingPayment: async () => undefined },
      schema: { strings: [] },
    } as never;
    const r = await completeCheckout(deps, b as never, {
      isFree: false,
      cancelToken: 'ph-ct-5',
      heldUntil: b.heldUntil,
      startsAt: b.startsAt,
      clientContact: CONTACT,
    });
    const url = new URL(r.paymentUrl as string);
    for (const key of ['SuccessURL', 'FailURL']) {
      const target = new URL(url.searchParams.get(key) as string);
      const res = await request(app.getHttpServer())
        .get(`${target.pathname}${target.search}`)
        .set('Host', target.host);
      expect([key, res.status]).toEqual([key, 302]);
    }
  });

  it('контроль: похожий путь /api/paymentx на алиасе по-прежнему 301 на канонический хост', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/paymentx')
      .set('Host', PRACTICE)
      .type('form')
      .send({ InvId: '1' });
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`https://${CANONICAL}/api/paymentx`);
  });
});
