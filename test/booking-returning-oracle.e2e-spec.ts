// security#19 (глобальный аудит 2026-10-11): публичная ручка записи не должна
// подтверждать, что контакт — клиент. `POST /api/booking/book` с returning=true
// отвечал 400 CLIENT_NOT_FOUND (контакта нет в ClientMeeting) или 200 HELD
// (есть) — анонимный оракул «этот человек ходит к психологу», заодно занимавший
// слот и славший админу «ожидает оплаты».
//
// Только живой Postgres (CI-джоба `migrations`): запись берёт advisory-lock
// через $executeRaw, а ClientMeeting ищется по clientKey — это свойства БД,
// фейковая Prisma их не воспроизводит (правило №18). Robokassa включена
// env.setup.ts: именно этот путь в проде оставляет бронь HELD и шлёт админу
// «ожидает оплаты» (без неё бронь подтверждается сразу). ADMIN_ID нужен, чтобы
// notifyAdmin дошёл до (фейкового) бота.
process.env.ADMIN_ID = '424242';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { clientKey } from '../src/booking/meeting-key';
import { RETURNING_NOT_FOUND_NOTE } from '../src/booking/booking-admin-note';
import { TELEGRAF_BOT } from '../src/telegram/telegram.constants';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';

const CLIENT = 'oracle-client@example.com'; // есть в ClientMeeting
const CLIENT_SPELLING = ' Oracle-Client@Example.com '; // другое написание того же контакта
const STRANGER = 'oracle-stranger@example.com'; // в ClientMeeting нет
const SLOT_CLIENT = new Date('2095-02-07T10:00:00.000Z');
const SLOT_STRANGER = new Date('2095-02-07T12:00:00.000Z');

const body = (contact: string, startsAt: Date) => ({
  startsAt: startsAt.toISOString(),
  durationMin: 50,
  type: 'SESSION_50',
  clientName: 'Проверка оракула',
  clientContact: contact,
  acceptedOffer: true,
  returning: true,
});

describe('e2e: returning=true не отличает клиента от не-клиента (security#19)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminDms: () => string[];

  const cleanup = async () => {
    await prisma.booking.deleteMany({
      where: { startsAt: { in: [SLOT_CLIENT, SLOT_STRANGER] } },
    });
    await prisma.clientMeeting.deleteMany({
      where: { clientKey: { in: [clientKey(CLIENT), clientKey(STRANGER)] } },
    });
    // Троттл записи (6/ч на IP) живёт в Postgres и переживает прогон.
    await prisma.throttleHit.deleteMany({});
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await cleanup();
    await prisma.clientMeeting.create({
      data: {
        clientKey: clientKey(CLIENT),
        meetingUrl: 'https://meet.jit.si/oracle-e2e',
        zoomMeetingId: null,
      },
    });
    const bot = app.get(TELEGRAF_BOT);
    bot.telegram.sendMessage.mockClear();
    adminDms = () =>
      bot.telegram.sendMessage.mock.calls.map((c: unknown[]) => String(c[1]));
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('клиент и не-клиент получают одинаковый ответ; бронь создана в обоих случаях', async () => {
    const asClient = await request(app.getHttpServer())
      .post('/api/booking/book')
      .send(body(CLIENT_SPELLING, SLOT_CLIENT));
    const asStranger = await request(app.getHttpServer())
      .post('/api/booking/book')
      .send(body(STRANGER, SLOT_STRANGER));

    // Один и тот же статус и одна и та же форма тела.
    expect(asClient.status).toBe(200);
    expect(asStranger.status).toBe(200);
    expect(Object.keys(asStranger.body).sort()).toEqual(
      Object.keys(asClient.body).sort(),
    );
    for (const res of [asClient, asStranger]) {
      expect(res.body.status).toBe('HELD');
      expect(res.body.paymentUrl).toEqual(expect.stringContaining('robokassa'));
      expect(res.body).not.toHaveProperty('meetingUrl');
    }
    expect(JSON.stringify(asStranger.body)).not.toContain('CLIENT_NOT_FOUND');

    // Контроль: оба раза бронь реально создана (не «отказ по-тихому»).
    const rows = await prisma.booking.findMany({
      where: { startsAt: { in: [SLOT_CLIENT, SLOT_STRANGER] } },
    });
    expect(rows.map((r) => r.status)).toEqual(['HELD', 'HELD']);
  });

  it('пометку «контакт не найден среди клиентов» получает только админ и только про не-клиента', () => {
    const awaiting = adminDms().filter((t) => t.includes('ожидает оплаты'));
    expect(awaiting).toHaveLength(2);
    const forStranger = awaiting.find((t) => t.includes(STRANGER));
    const forClient = awaiting.find((t) => t.toLowerCase().includes(CLIENT));
    expect(forStranger).toContain(RETURNING_NOT_FOUND_NOTE);
    expect(forClient).toBeDefined();
    expect(forClient).not.toContain(RETURNING_NOT_FOUND_NOTE);
  });
});
