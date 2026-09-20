// e2e read-after-write: контракт «Календарь слотов в админке» (SlotOverride).
// Тот же стиль, что app-ownership.e2e-spec.ts — buildTestApp() (фейк-Prisma
// по умолчанию, E2E_REAL_DB=1 переключает на живой Postgres). Сценарий бьёт
// СКВОЗЬ HTTP: правило → слот виден → BLOCK → слот пропал ВЕЗДЕ (публичный
// /slots И админский /calendar) → бронь блокируется → clear → слот вернулся.
// Второй сценарий: OPEN вне правил. Третий: доступ без x-admin-key.
//
// ADMIN_BOOKING_KEY не задан в test/e2e-support/env.setup.ts (ни один
// существующий e2e не ходил в admin-эндпоинты бронирования) — выставляем
// здесь, до buildTestApp(): ConfigService читает env один раз при сборке
// AppModule внутри buildTestApp(), а не лениво при каждом get().
process.env.ADMIN_BOOKING_KEY = 'e2e-slot-override-admin-key';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';

const ADMIN_KEY = process.env.ADMIN_BOOKING_KEY;
// Далеко в будущем (за пределами любого реального расписания) — и не
// пересекается с фикстурой booking-slot-lock.e2e-spec.ts (2091-03-04).
const FUTURE_DATE = '2093-05-10';
const FUTURE_DOW = new Date(`${FUTURE_DATE}T00:00:00Z`).getUTCDay();
const RULE_SLOT_ISO = `${FUTURE_DATE}T09:00:00.000Z`;
const OPEN_SLOT_ISO = `${FUTURE_DATE}T20:00:00.000Z`;

function slotStarts(body: { startsAt: string }[]): string[] {
  return body.map((s) => s.startsAt);
}

describe('e2e: календарь слотов в админке — SlotOverride read-after-write', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  let ruleId: number;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });

  afterAll(async () => {
    // Порядок cleanup'а не важен — все ключи собственные, свежесозданные в
    // этом прогоне (как booking-slot-lock.e2e-spec.ts чистит по startsAt).
    await prisma.slotOverride.deleteMany({
      where: {
        startsAt: { in: [new Date(RULE_SLOT_ISO), new Date(OPEN_SLOT_ISO)] },
      },
    });
    await prisma.booking.deleteMany({
      where: { startsAt: new Date(RULE_SLOT_ISO) },
    });
    if (ruleId)
      await prisma.availabilityRule.deleteMany({ where: { id: ruleId } });
    await app.close();
  });

  it('правило создаётся за x-admin-key', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking/admin/rules')
      .set('x-admin-key', ADMIN_KEY)
      .send({
        dayOfWeek: FUTURE_DOW,
        startHour: 9,
        endHour: 18,
        sessionDuration: 50,
        bufferMin: 10,
        timezone: 'UTC',
      });
    expect(res.status).toBe(200);
    expect(res.body.id).toEqual(expect.any(Number));
    ruleId = res.body.id;
  });

  it('слот на будущий день виден в публичном /slots', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/booking/slots?from=${FUTURE_DATE}&to=${FUTURE_DATE}`,
    );
    expect(res.status).toBe(200);
    expect(slotStarts(res.body)).toContain(RULE_SLOT_ISO);
  });

  it('BLOCK убирает слот из /slots и помечает ячейку blocked в /calendar', async () => {
    const patch = await request(app.getHttpServer())
      .post('/api/booking/admin/calendar/overrides')
      .set('x-admin-key', ADMIN_KEY)
      .send({
        set: [{ startsAt: RULE_SLOT_ISO, durationMin: 50, kind: 'BLOCK' }],
      });
    expect(patch.status).toBe(200);
    expect(patch.body).toEqual({ ok: true });

    const slots = await request(app.getHttpServer()).get(
      `/api/booking/slots?from=${FUTURE_DATE}&to=${FUTURE_DATE}`,
    );
    expect(slotStarts(slots.body)).not.toContain(RULE_SLOT_ISO);

    const cal = await request(app.getHttpServer())
      .get(`/api/booking/admin/calendar?from=${FUTURE_DATE}&to=${FUTURE_DATE}`)
      .set('x-admin-key', ADMIN_KEY);
    expect(cal.status).toBe(200);
    const cell = cal.body.days[0].cells.find(
      (c: { startsAt: string }) => c.startsAt === RULE_SLOT_ISO,
    );
    expect(cell?.state).toBe('blocked');
  });

  it('бронь на заблокированный слот отклоняется 400 SLOT_BLOCKED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking/book')
      .send({
        startsAt: RULE_SLOT_ISO,
        durationMin: 50,
        type: 'SESSION_50',
        clientName: 'E2E Тест',
        clientContact: 'e2e-slot-override@example.com',
        acceptedOffer: true,
      });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('SLOT_BLOCKED');
  });

  it('clear возвращает слот в /slots', async () => {
    const patch = await request(app.getHttpServer())
      .post('/api/booking/admin/calendar/overrides')
      .set('x-admin-key', ADMIN_KEY)
      .send({ clear: [RULE_SLOT_ISO] });
    expect(patch.status).toBe(200);

    const slots = await request(app.getHttpServer()).get(
      `/api/booking/slots?from=${FUTURE_DATE}&to=${FUTURE_DATE}`,
    );
    expect(slotStarts(slots.body)).toContain(RULE_SLOT_ISO);
  });

  it('OPEN вне правил добавляет слот в /slots и помечает ячейку extra в /calendar', async () => {
    const patch = await request(app.getHttpServer())
      .post('/api/booking/admin/calendar/overrides')
      .set('x-admin-key', ADMIN_KEY)
      .send({
        set: [{ startsAt: OPEN_SLOT_ISO, durationMin: 45, kind: 'OPEN' }],
      });
    expect(patch.status).toBe(200);

    const slots = await request(app.getHttpServer()).get(
      `/api/booking/slots?from=${FUTURE_DATE}&to=${FUTURE_DATE}`,
    );
    expect(slotStarts(slots.body)).toContain(OPEN_SLOT_ISO);

    const cal = await request(app.getHttpServer())
      .get(`/api/booking/admin/calendar?from=${FUTURE_DATE}&to=${FUTURE_DATE}`)
      .set('x-admin-key', ADMIN_KEY);
    const cell = cal.body.days[0].cells.find(
      (c: { startsAt: string }) => c.startsAt === OPEN_SLOT_ISO,
    );
    expect(cell?.state).toBe('extra');
  });

  it('без x-admin-key — 403 на обоих новых роутах', async () => {
    const cal = await request(app.getHttpServer()).get(
      `/api/booking/admin/calendar?from=${FUTURE_DATE}&to=${FUTURE_DATE}`,
    );
    expect(cal.status).toBe(403);

    const patch = await request(app.getHttpServer())
      .post('/api/booking/admin/calendar/overrides')
      .send({ clear: [OPEN_SLOT_ISO] });
    expect(patch.status).toBe(403);
  });
});
