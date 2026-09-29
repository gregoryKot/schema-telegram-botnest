// e2e smoke: GET /api/booking/ics/:token (PR B «После записи: сохранить
// ссылку и добавить в календарь»). Только живой Postgres (CI-джоба
// `migrations`), как booking-slot-lock.e2e-spec.ts — POST /api/booking/book
// берёт advisory-lock через $executeRaw (booking-slot-lock.ts), а фейковая
// Prisma такой сырой SQL не эмулирует (правило №18 CLAUDE.md). Токен —
// capability (ownership: чужой/неизвестный токен не должен отдавать чужое
// событие) — здесь «чужой» = «любой другой незнакомый токен», у брони нет
// владельца-пользователя.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  buildRealDbTestApp,
  RealDbTestApp,
} from './e2e-support/build-real-db-test-app';

const STARTS_AT = new Date('2092-04-20T10:00:00.000Z');
const CANCEL_STARTS_AT = new Date('2092-04-21T10:00:00.000Z');

async function bookFreeSlot(app: INestApplication, startsAt: Date) {
  const res = await request(app.getHttpServer())
    .post('/api/booking/book')
    .send({
      startsAt: startsAt.toISOString(),
      durationMin: 15,
      type: 'INTRO_15',
      clientName: 'ICS e2e',
      clientContact: 'e2e-booking-ics@example.com',
      acceptedOffer: true,
    });
  expect(res.status).toBe(200);
  return res.body.cancelToken as string;
}

describe('e2e: GET /api/booking/ics/:token', () => {
  let app: INestApplication;
  let prisma: RealDbTestApp['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({
      where: { startsAt: { in: [STARTS_AT, CANCEL_STARTS_AT] } },
    });
    await app.close();
  });

  it('неизвестный токен → 404, не 200 с пустым мусором', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/booking/ics/does-not-exist-token',
    );
    expect(res.status).toBe(404);
  });

  it('известный токен → text/calendar с Content-Disposition attachment и валидным VCALENDAR', async () => {
    const token = await bookFreeSlot(app, STARTS_AT);
    const res = await request(app.getHttpServer()).get(
      `/api/booking/ics/${token}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.headers['content-disposition']).toContain(
      'attachment; filename="zapis.ics"',
    );
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('DTSTART:20920420T100000Z');
    // Ownership: ссылка/токен из ЭТОЙ брони — не токен и не имя чужой.
    expect(res.text).not.toContain('ICS e2e');
    expect(res.text).not.toContain('e2e-booking-ics@example.com');
  });

  it('отменённая бронь → 410, .ics для отменённой встречи не выдаётся', async () => {
    const token = await bookFreeSlot(app, CANCEL_STARTS_AT);
    const cancelRes = await request(app.getHttpServer()).post(
      `/api/booking/cancel/${token}`,
    );
    expect(cancelRes.status).toBe(200);

    const res = await request(app.getHttpServer()).get(
      `/api/booking/ics/${token}`,
    );
    expect(res.status).toBe(410);
  });
});
