// Аудит 2026-10 (docs/open/security.md, #824): ключ постоянной комнаты клиента
// (ClientMeeting.clientKey) склеивал разные ящики — нормализация стирала `-` и
// `+` у любого контакта, и бронь с ящиком `ivanpetrov@` получала комнату
// клиента `ivan-petrov@`, а владелец пересылал её на ящик записавшегося. Ключ
// был несолёным sha256 — по дампу перебирался словарём. Теперь нормализация по
// форме контакта и HMAC с серверным ключом (src/booking/client-key.ts), а
// старые строки переводит проход на старте (client-key-rekey.service.ts).
//
// Только живой Postgres (CI-джоба `migrations`): шов — между нормализацией и
// поиском ClientMeeting в настоящей БД, перенос строки меняет первичный ключ
// (уникальность проверяет Postgres), бронь берёт advisory-lock через
// $executeRaw. ENCRYPTION_KEY задаёт test/setup-e2e.ts до импорта модулей —
// проверяется ветка HMAC (`k1:`), а не запасная `k0:`.
process.env.ADMIN_ID = '424245';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { clientKey, legacyClientKey } from '../src/booking/client-key';
import { ClientKeyRekeyService } from '../src/booking/client-key-rekey.service';
import { decrypt, encrypt } from '../src/utils/crypto';
import { TELEGRAF_BOT } from '../src/telegram/telegram.constants';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';

const DASHED = 'ck-ivan-petrov@example.com';
const PLAIN = 'ck-ivanpetrov@example.com'; // по старой формуле — тот же ключ
const RETURNING = 'ck-returning@example.com'; // строка в старом формате
const SHARED_FIRST = 'ck-a@my-site.example'; // склейка: бронь раньше
const SHARED_LATER = 'ck-a@mysite.example'; // склейка: бронь позже
const ORPHAN = 'ck-orphan@example.com'; // строка без единой живой брони
const ANON = 'ck-anon@example.com'; // новый формат, брони обезличены
const FIXTURE_KEY = 'ck-e2e-fixture-client'; // не hex: чужая фикстура
const CONTACTS = [
  DASHED,
  PLAIN,
  RETURNING,
  SHARED_FIRST,
  SHARED_LATER,
  ORPHAN,
  ANON,
];

const ROOM_RETURNING = 'https://zoom.example/j/ck-returning?pwd=r';
const ROOM_SHARED = 'https://zoom.example/j/ck-shared?pwd=s';
const SLOT_DASHED = new Date('2095-03-14T10:00:00.000Z');
const SLOT_PLAIN = new Date('2095-03-14T12:00:00.000Z');
const SLOT_RETURN = new Date('2095-03-14T14:00:00.000Z');
const SLOTS = [SLOT_DASHED, SLOT_PLAIN, SLOT_RETURN];
const SEED_TOKENS = [
  'ck-e2e-returning',
  'ck-e2e-shared-first',
  'ck-e2e-shared-later',
];
const DAY = 86_400_000;

const body = (contact: string, startsAt: Date) => ({
  startsAt: startsAt.toISOString(),
  durationMin: 15,
  type: 'INTRO_15',
  clientName: 'Проверка ключа',
  clientContact: contact,
  acceptedOffer: true,
});

describe('e2e: ключ комнаты клиента не склеивает разные ящики (аудит 2026-10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rekey: ClientKeyRekeyService;
  let adminDms: () => string[];

  const cleanup = async () => {
    await prisma.booking.deleteMany({
      where: {
        OR: [{ startsAt: { in: SLOTS } }, { cancelToken: { in: SEED_TOKENS } }],
      },
    });
    const keys = CONTACTS.flatMap((c) => [clientKey(c), legacyClientKey(c)]);
    await prisma.clientMeeting.deleteMany({
      where: { clientKey: { in: [...keys, FIXTURE_KEY] } },
    });
    // Троттл записи (6/ч на IP) живёт в Postgres и переживает прогон.
    await prisma.throttleHit.deleteMany({});
  };

  const book = (contact: string, startsAt: Date) =>
    request(app.getHttpServer())
      .post('/api/booking/book')
      .send(body(contact, startsAt));
  const linkOf = async (startsAt: Date) =>
    decrypt(
      (await prisma.booking.findFirst({ where: { startsAt } }))?.meetingUrl ??
        null,
    );
  const room = async (key: string) =>
    decrypt(
      (await prisma.clientMeeting.findUnique({ where: { clientKey: key } }))
        ?.meetingUrl ?? null,
    );
  const seedBooking = (
    token: string,
    contact: string,
    url: string,
    createdAt: Date,
  ) =>
    prisma.booking.create({
      data: {
        startsAt: new Date('2095-03-21T10:00:00.000Z'),
        durationMin: 50,
        status: 'CONFIRMED',
        clientName: encrypt('Проверка ключа') ?? '',
        clientContact: encrypt(contact) ?? contact,
        cancelToken: token,
        meetingUrl: encrypt(url),
        // эффекты подтверждения «доделаны»: ретрай-крон эти брони не берёт
        confirmEffectsDoneAt: createdAt,
        createdAt,
      },
    });
  const seedRow = (clientKey: string, url: string, createdAt = new Date()) =>
    prisma.clientMeeting.create({
      data: { clientKey, meetingUrl: encrypt(url) ?? url, createdAt },
    });

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    rekey = app.get(ClientKeyRekeyService);
    await cleanup();
    const bot = app.get(TELEGRAF_BOT);
    bot.telegram.sendMessage.mockClear();
    adminDms = () =>
      bot.telegram.sendMessage.mock.calls.map((c: unknown[]) => String(c[1]));
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('`ivan-petrov@` и `ivanpetrov@` получают разные комнаты (на старой формуле — одну)', async () => {
    expect(legacyClientKey(DASHED)).toBe(legacyClientKey(PLAIN));
    expect((await book(DASHED, SLOT_DASHED)).status).toBe(200);
    expect((await book(PLAIN, SLOT_PLAIN)).status).toBe(200);
    const [a, b] = [await linkOf(SLOT_DASHED), await linkOf(SLOT_PLAIN)];
    expect(a).toMatch(/^https:\/\//);
    expect(b).toMatch(/^https:\/\//);
    expect(b).not.toBe(a);
    expect(clientKey(DASHED)).toMatch(/^k1:[0-9a-f]{64}$/);
    expect(await room(clientKey(DASHED))).toBe(a);
    expect(await room(clientKey(PLAIN))).toBe(b);
  });

  it('перевод старых строк: клиент сохраняет комнату, склейка остаётся за ранней бронью, сироты удалены', async () => {
    const old = new Date(Date.now() - 2 * DAY);
    await seedRow(legacyClientKey(RETURNING), ROOM_RETURNING, old);
    await seedBooking('ck-e2e-returning', RETURNING, ROOM_RETURNING, old);
    expect(legacyClientKey(SHARED_FIRST)).toBe(legacyClientKey(SHARED_LATER));
    await seedRow(legacyClientKey(SHARED_FIRST), ROOM_SHARED, old);
    await seedBooking('ck-e2e-shared-first', SHARED_FIRST, ROOM_SHARED, old);
    const later = await seedBooking(
      'ck-e2e-shared-later',
      SHARED_LATER,
      ROOM_SHARED,
      new Date(old.getTime() + DAY),
    );
    await seedRow(
      legacyClientKey(ORPHAN),
      'https://meet.jit.si/ck-orphan',
      old,
    );
    await seedRow(clientKey(ANON), 'https://meet.jit.si/ck-anon', old);
    await seedRow(FIXTURE_KEY, 'https://meet.jit.si/ck-fixture', old);

    const stats = await rekey.run();
    expect(stats.shared).toEqual([later.id]);
    expect(stats.stale).toEqual([]);

    expect(await room(clientKey(RETURNING))).toBe(ROOM_RETURNING);
    expect(await room(legacyClientKey(RETURNING))).toBeNull();
    expect(await room(clientKey(SHARED_FIRST))).toBe(ROOM_SHARED);
    expect(await room(clientKey(SHARED_LATER))).toBeNull();
    expect(await room(legacyClientKey(ORPHAN))).toBeNull();
    expect(await room(clientKey(ANON))).toBe('https://meet.jit.si/ck-anon');
    expect(await room(FIXTURE_KEY)).toBe('https://meet.jit.si/ck-fixture');

    const dms = adminDms().filter((t) => t.includes('Ключи комнат клиентов'));
    expect(dms).toHaveLength(1);
    expect(dms[0]).toContain(`№${later.id}`);
  });

  it('read-after-write: повторная бронь переведённого клиента получает прежнюю комнату', async () => {
    expect((await book(RETURNING, SLOT_RETURN)).status).toBe(200);
    expect(await linkOf(SLOT_RETURN)).toBe(ROOM_RETURNING);
  });

  it('повторный проход ничего не меняет', async () => {
    const snapshot = await prisma.clientMeeting.findMany({
      orderBy: { clientKey: 'asc' },
    });
    const dmsBefore = adminDms().length;
    const stats = await rekey.run();
    expect(stats).toEqual({
      moved: 0,
      dropped: 0,
      purged: 0,
      shared: [],
      stale: [],
    });
    expect(
      await prisma.clientMeeting.findMany({ orderBy: { clientKey: 'asc' } }),
    ).toEqual(snapshot);
    expect(adminDms().length).toBe(dmsBefore);
  });
});
