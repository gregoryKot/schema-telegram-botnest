// Аудит 2026-10-11, r2-1#2: GET /api/booking/slots раздавал слоты последнего
// дня окна свободными, хотя на них стояла бронь: брони читались по сырому
// toDate (для ?to=YYYY-MM-DD это 00:00Z — невидим весь последний день), слоты —
// до 23:59:59.999Z. Клиент заполнял форму и получал 409.
//
// Юнит-спек гоняет SlotService на фейковой Prisma; здесь — тот же сценарий
// СКВОЗЬ HTTP на живом Postgres (джоба `migrations`): фильтр по startsAt
// делает настоящая СУБД, а инвариант проверяется в обе стороны — слот, которого
// нет в выдаче, занят, а слот из выдачи проходит POST /book без 409.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';

// Далеко в будущем и не пересекается с фикстурами других e2e (2091-03-04,
// 2093-05-10): по startsAt спек чистит за собой.
const LAST_DAY = '2094-03-09';
const PREV_DAY = '2094-03-08';
const DOW = new Date(`${LAST_DAY}T00:00:00Z`).getUTCDay();
const at = (hh: string) => `${LAST_DAY}T${hh}:00:00.000Z`;
const TAKEN = at('09'); // занят CONFIRMED-бронью
const FREE = at('10'); // контроль: свободен, и именно его бронирует клиент

describe('e2e: слоты последнего дня окна на живом Postgres', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ruleId: number;

  const cleanup = () =>
    prisma.booking.deleteMany({
      where: { startsAt: { in: [new Date(TAKEN), new Date(FREE)] } },
    });

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await cleanup();
    const rule = await prisma.availabilityRule.create({
      data: {
        dayOfWeek: DOW,
        startHour: 9,
        startMinute: 0,
        endHour: 12,
        endMinute: 0,
        sessionDuration: 50,
        bufferMin: 10,
        timezone: 'UTC',
        isActive: true,
      },
    });
    ruleId = rule.id;
    await prisma.booking.create({
      data: {
        startsAt: new Date(TAKEN),
        durationMin: 50,
        type: 'SESSION_50',
        status: 'CONFIRMED',
        clientName: 'slot-last-day',
        clientContact: 'slot-last-day@example.com',
        cancelToken: 'slot-last-day-token',
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.availabilityRule.deleteMany({ where: { id: ruleId } });
    await app.close();
  });

  it('?to=YYYY-MM-DD: бронь последнего дня скрывает слот, свободный остаётся', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/booking/slots?from=${PREV_DAY}&to=${LAST_DAY}`,
    );
    expect(res.status).toBe(200);
    const starts: string[] = res.body.map(
      (s: { startsAt: string }) => s.startsAt,
    );
    expect(starts).not.toContain(TAKEN);
    expect(starts).toContain(FREE);
  });

  it('слот из выдачи проходит POST /book без 409, и после этого исчезает из выдачи', async () => {
    const book = await request(app.getHttpServer())
      .post('/api/booking/book')
      .send({
        startsAt: FREE,
        durationMin: 15,
        type: 'INTRO_15',
        clientName: 'Проверка слотов',
        clientContact: 'slot-last-day-client@example.com',
        acceptedOffer: true,
      });
    expect(book.status).toBe(200);

    const after = await request(app.getHttpServer()).get(
      `/api/booking/slots?from=${PREV_DAY}&to=${LAST_DAY}`,
    );
    const starts: string[] = after.body.map(
      (s: { startsAt: string }) => s.startsAt,
    );
    expect(starts).not.toContain(FREE);
  });
});
