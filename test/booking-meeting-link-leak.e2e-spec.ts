// Аудит 2026-10 (docs/open/audit-2026-10.md, внесено #662): анонимная запись
// отдавала чужую ссылку на встречу. `POST /api/booking/book` без проверки
// владения контактом: INTRO_15 (бесплатно) и SESSION_50 вне рублей (#796)
// подтверждаются сразу, подтверждение ищет ClientMeeting по clientKey(контакт)
// и переиспользует постоянную комнату клиента — её ссылка уходила в ответ, в
// `GET /by-token/:token` и в `.ics` по выданному тем же ответом токену. Назвав
// чужой контакт, любой получал комнату клиента психолога (Zoom с `?pwd=`).
//
// Только живой Postgres (CI-джоба `migrations`): ClientMeeting ищется по
// clientKey в настоящей БД, бронь берёт advisory-lock через $executeRaw —
// фейковая Prisma этого не воспроизводит (правило №18). ADMIN_ID нужен, чтобы
// DM «Запись подтверждена» дошёл до фейкового бота: это законный путь ссылки
// к владельцу, и его доставку тест проверяет как контроль.
process.env.ADMIN_ID = '424243';
// Админка — второй законный путь ссылки к владельцу (ревью): список записей
// под ключом. ConfigService читает env при сборке приложения — ставим до неё.
process.env.ADMIN_BOOKING_KEY = 'e2e-meeting-link-admin-key-0123456789abcdef';
const ADMIN_KEY = process.env.ADMIN_BOOKING_KEY;

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { clientKey, legacyClientKey } from '../src/booking/client-key';
import { decrypt, encrypt } from '../src/utils/crypto';
import { TELEGRAF_BOT } from '../src/telegram/telegram.constants';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';
import {
  LINK_TO_FORWARD,
  ROOM_REPLACED,
} from '../src/booking/booking-confirmed-card';

const VICTIM = 'victim-link@example.com'; // есть в ClientMeeting
const VICTIM_SPELLING = ' Victim-Link@Example.com '; // то же лицо, другое написание
const NEWCOMER = 'newcomer-link@example.com'; // в ClientMeeting нет
const LEGACY_CLIENT = 'legacy-link@example.com'; // комната по старой формуле
const SECRET_URL = 'https://zoom.example/j/1?pwd=secret';
const SLOT_INTRO = new Date('2095-03-07T10:00:00.000Z');
const SLOT_SESSION = new Date('2095-03-07T12:00:00.000Z');
const SLOT_NEWCOMER = new Date('2095-03-07T14:00:00.000Z');
const SLOT_LEGACY = new Date('2095-03-07T11:00:00.000Z');
const SLOTS = [SLOT_INTRO, SLOT_SESSION, SLOT_NEWCOMER, SLOT_LEGACY];
// Старая формула: адрес комнаты считался из контакта без единого запроса.
const LEGACY_ROOM = `https://meet.jit.si/schemehappens-${legacyClientKey(LEGACY_CLIENT).slice(0, 12)}`;

const body = (
  contact: string,
  startsAt: Date,
  type: 'INTRO_15' | 'SESSION_50',
  clientTimeZone?: string,
) => ({
  startsAt: startsAt.toISOString(),
  durationMin: type === 'INTRO_15' ? 15 : 50,
  type,
  clientName: 'Проверка ссылки',
  clientContact: contact,
  acceptedOffer: true,
  ...(clientTimeZone ? { clientTimeZone } : {}),
});

const leaks = (text: string) =>
  text.includes('pwd=secret') || text.includes('zoom.example');

describe('e2e: анонимная запись не отдаёт ссылку на встречу (аудит 2026-10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminDms: () => string[];
  const responses: Record<string, request.Response> = {};

  const cleanup = async () => {
    await prisma.booking.deleteMany({ where: { startsAt: { in: SLOTS } } });
    await prisma.clientMeeting.deleteMany({
      where: {
        clientKey: {
          in: [VICTIM, NEWCOMER, LEGACY_CLIENT].map((c) => clientKey(c)),
        },
      },
    });
    // Троттл записи (6/ч на IP) живёт в Postgres и переживает прогон.
    await prisma.throttleHit.deleteMany({});
  };

  const book = (b: ReturnType<typeof body>) =>
    request(app.getHttpServer()).post('/api/booking/book').send(b);

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await cleanup();
    await prisma.clientMeeting.create({
      data: {
        clientKey: clientKey(VICTIM),
        meetingUrl: encrypt(SECRET_URL) ?? SECRET_URL,
        zoomMeetingId: null,
      },
    });
    await prisma.clientMeeting.create({
      data: {
        clientKey: clientKey(LEGACY_CLIENT),
        meetingUrl: encrypt(LEGACY_ROOM) ?? LEGACY_ROOM,
        zoomMeetingId: null,
      },
    });
    const bot = app.get(TELEGRAF_BOT);
    bot.telegram.sendMessage.mockClear();
    adminDms = () =>
      bot.telegram.sendMessage.mock.calls.map((c: unknown[]) => String(c[1]));

    responses.intro = await book(body(VICTIM_SPELLING, SLOT_INTRO, 'INTRO_15'));
    responses.manual = await book(
      body(VICTIM_SPELLING, SLOT_SESSION, 'SESSION_50', 'Europe/Berlin'),
    );
    responses.newcomer = await book(body(NEWCOMER, SLOT_NEWCOMER, 'INTRO_15'));
    responses.legacy = await book(body(LEGACY_CLIENT, SLOT_LEGACY, 'INTRO_15'));
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('ответ book по чужому контакту не несёт ссылку: INTRO_15 и SESSION_50 вне рублей', () => {
    for (const res of [responses.intro, responses.manual]) {
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body).not.toHaveProperty('meetingUrl');
      expect(leaks(res.text)).toBe(false);
    }
  });

  it('по выданному токену ни by-token, ни .ics ссылку не отдают', async () => {
    for (const res of [responses.intro, responses.manual]) {
      const token = res.body.cancelToken as string;
      const pub = await request(app.getHttpServer()).get(
        `/api/booking/by-token/${token}`,
      );
      expect(pub.status).toBe(200);
      expect(pub.body.status).toBe('CONFIRMED');
      expect(pub.body).not.toHaveProperty('meetingUrl');
      expect(leaks(pub.text)).toBe(false);

      const ics = await request(app.getHttpServer()).get(
        `/api/booking/ics/${token}`,
      );
      expect(ics.status).toBe(200);
      expect(ics.text).toContain('BEGIN:VEVENT');
      expect(leaks(ics.text)).toBe(false);
      expect(ics.text).not.toMatch(/^LOCATION/m);
    }
  });

  it('контроль доставки: ссылка дошла до владельца — в строке брони и в DM «Запись подтверждена»', async () => {
    const rows = await prisma.booking.findMany({
      where: { startsAt: { in: [SLOT_INTRO, SLOT_SESSION] } },
    });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.meetingUrl).not.toContain('pwd=secret'); // в БД зашифрована
      expect(decrypt(r.meetingUrl)).toBe(SECRET_URL);
    }
    const confirmed = adminDms().filter(
      (t) =>
        t.includes('Запись подтверждена') && t.toLowerCase().includes(VICTIM),
    );
    expect(confirmed).toHaveLength(2);
    for (const dm of confirmed) {
      expect(dm).toContain(SECRET_URL);
      // владелец — единственный канал доставки, карточка это говорит
      expect(dm).toContain(LINK_TO_FORWARD);
      expect(dm).not.toContain(ROOM_REPLACED); // комната жертвы прежняя
    }
  });

  it('админка: список записей под ключом отдаёт расшифрованную ссылку, без ключа — 403', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/booking/admin/list?filter=all')
      .set('x-admin-key', ADMIN_KEY);
    expect(list.status).toBe(200);
    const mine = (
      list.body as { startsAt: string; meetingUrl: string }[]
    ).filter((b) => b.startsAt === SLOT_INTRO.toISOString());
    expect(mine).toHaveLength(1);
    expect(mine[0].meetingUrl).toBe(SECRET_URL);

    const anon = await request(app.getHttpServer()).get(
      '/api/booking/admin/list?filter=all',
    );
    expect(anon.status).toBe(403);
    expect(leaks(anon.text)).toBe(false);
  });

  it('новый контакт: комната создана, в ответ не ушла и не выводится из контакта', async () => {
    const res = responses.newcomer;
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('meetingUrl');
    const cm = await prisma.clientMeeting.findUnique({
      where: { clientKey: clientKey(NEWCOMER) },
    });
    const url = decrypt(cm?.meetingUrl ?? null) ?? '';
    expect(url).toMatch(/^https:\/\//);
    expect(res.text).not.toContain(url);
    // старая формула: schemehappens-<sha256(контакт)[0..12]> — знающий контакт
    // вычислял комнату без запроса
    expect(url).not.toContain(legacyClientKey(NEWCOMER).slice(0, 12));
  });

  it('форма ответа INTRO одинакова для клиента и не-клиента (оракул #662)', () => {
    expect(Object.keys(responses.newcomer.body).sort()).toEqual(
      Object.keys(responses.intro.body).sort(),
    );
  });

  // Условная запись по прежнему шифротексту (meeting-jitsi.ts) идёт через
  // настоящий Prisma: where по зашифрованной колонке обязан совпасть с тем, что
  // лежит в строке, иначе замена молча не случится и клиент останется в
  // вычисляемой комнате.
  it('комната по старой формуле при следующей брони заменена: в ClientMeeting и в брони одна новая', async () => {
    expect(responses.legacy.status).toBe(200);
    expect(responses.legacy.text).not.toContain('meet.jit.si');
    const cm = await prisma.clientMeeting.findUnique({
      where: { clientKey: clientKey(LEGACY_CLIENT) },
    });
    const fresh = decrypt(cm?.meetingUrl ?? null) ?? '';
    expect(fresh).toMatch(
      /^https:\/\/meet\.jit\.si\/schemehappens-[0-9a-f]{16}$/,
    );
    expect(fresh).not.toBe(LEGACY_ROOM);
    const row = await prisma.booking.findFirst({
      where: { startsAt: SLOT_LEGACY },
    });
    expect(decrypt(row?.meetingUrl ?? null)).toBe(fresh);
    // клиент по старой ссылке придёт не туда — владелец узнаёт о замене из DM
    const dm = adminDms().filter(
      (t) => t.includes('Запись подтверждена') && t.includes(LEGACY_CLIENT),
    );
    expect(dm).toHaveLength(1);
    expect(dm[0]).toContain(fresh);
    expect(dm[0]).toContain(ROOM_REPLACED);
  });
});
