// e2e: отмена брони владельцем в любой срок (аудит 2026-10-11, security#22).
// Админка визитки жала публичный POST /api/booking/cancel/:token, а у него
// клиентский cutoff 24 ч: за сутки до встречи сервер отвечал 400
// CANCEL_TOO_LATE, и бронь жила дальше (событие iCloud, слот, напоминания).
// Здесь — сквозь HTTP, настоящий AppModule: POST /api/booking/admin/cancel/:id
// за x-admin-key отменяет и «за 2 часа», переход тот же CAS, повтор
// идемпотентен, а публичный маршрут по-прежнему держит cutoff.
//
// ADMIN_BOOKING_KEY выставляем до buildTestApp(): ConfigService читает env
// один раз при сборке AppModule (как slot-override.e2e-spec.ts).
process.env.ADMIN_BOOKING_KEY = 'e2e-admin-cancel-key-0123456789abcdefghij';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';

const ADMIN_KEY = process.env.ADMIN_BOOKING_KEY;
const TOKEN_PREFIX = 'e2e-admin-cancel-';
const HOUR = 3_600_000;

describe('e2e: админская отмена брони в любой срок', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({
      where: { cancelToken: { startsWith: TOKEN_PREFIX } },
    });
    await app.close();
  });

  async function seed(
    name: string,
    status: 'HELD' | 'CONFIRMED' | 'COMPLETED',
    hoursAhead: number,
  ) {
    return prisma.booking.create({
      data: {
        startsAt: new Date(Date.now() + hoursAhead * HOUR),
        durationMin: 50,
        type: 'SESSION_50',
        status,
        heldUntil: null,
        clientName: 'Клиент',
        clientContact: '@c',
        cancelToken: `${TOKEN_PREFIX}${name}`,
      },
    });
  }

  const statusOf = async (token: string) =>
    (await prisma.booking.findUnique({ where: { cancelToken: token } }))
      ?.status;

  it('без x-admin-key и с неверным ключом — 403, бронь не тронута', async () => {
    const b = await seed('no-key', 'CONFIRMED', 2);
    const none = await request(app.getHttpServer()).post(
      `/api/booking/admin/cancel/${b.id}`,
    );
    const wrong = await request(app.getHttpServer())
      .post(`/api/booking/admin/cancel/${b.id}`)
      .set('x-admin-key', 'x'.repeat(40));
    expect([none.status, wrong.status]).toEqual([403, 403]);
    expect(await statusOf(b.cancelToken)).toBe('CONFIRMED');
  });

  it('встреча через 2 часа: публичный маршрут 400, админский 200 и CANCELLED', async () => {
    const b = await seed('2h', 'CONFIRMED', 2);
    const pub = await request(app.getHttpServer()).post(
      `/api/booking/cancel/${b.cancelToken}`,
    );
    expect(pub.status).toBe(400);
    expect(pub.body.message).toBe('CANCEL_TOO_LATE');
    expect(await statusOf(b.cancelToken)).toBe('CONFIRMED');

    const admin = await request(app.getHttpServer())
      .post(`/api/booking/admin/cancel/${b.id}`)
      .set('x-admin-key', ADMIN_KEY);
    expect(admin.status).toBe(200);
    expect(admin.body).toEqual({ ok: true });
    expect(await statusOf(b.cancelToken)).toBe('CANCELLED');

    // read-after-write: админский список «Отменённые» видит эту бронь.
    const list = await request(app.getHttpServer())
      .get('/api/booking/admin/list?filter=cancelled')
      .set('x-admin-key', ADMIN_KEY);
    const row = list.body.find((r: { id: number }) => r.id === b.id);
    expect(row?.status).toBe('CANCELLED');
  });

  it('HELD тоже отменяется; повторная отмена — идемпотентный 200', async () => {
    const b = await seed('held', 'HELD', 1);
    const call = () =>
      request(app.getHttpServer())
        .post(`/api/booking/admin/cancel/${b.id}`)
        .set('x-admin-key', ADMIN_KEY);
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    expect(await statusOf(b.cancelToken)).toBe('CANCELLED');
  });

  it('завершённую бронь не отменяет (400), несуществующую — 404, не число — 400', async () => {
    const done = await seed('done', 'COMPLETED', -3);
    const r400 = await request(app.getHttpServer())
      .post(`/api/booking/admin/cancel/${done.id}`)
      .set('x-admin-key', ADMIN_KEY);
    expect(r400.status).toBe(400);
    expect(await statusOf(done.cancelToken)).toBe('COMPLETED');

    const r404 = await request(app.getHttpServer())
      .post('/api/booking/admin/cancel/2147483000')
      .set('x-admin-key', ADMIN_KEY);
    expect(r404.status).toBe(404);

    const bad = await request(app.getHttpServer())
      .post('/api/booking/admin/cancel/abc')
      .set('x-admin-key', ADMIN_KEY);
    expect(bad.status).toBe(400);
  });
});
