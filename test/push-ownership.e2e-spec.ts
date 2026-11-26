// e2e SMOKE уведомлений в приложении (правило: новый контроллер = e2e-смок на
// ownership). Юнит-спеки PushService проверяют where по userId и исходы
// отправки, но не отвечают на «guard примонтирован?», «DTO валидирует тело?»,
// «чужой endpoint не удаляет чужую подписку?» и «экран настроек видит тот же
// канал, что выберет очередь?» (сохранил → нашёл). Ротация подписки — ручка
// без входа: чужую строку без старого адреса не сдвинуть.
//
// Гоняется дважды: на фейковой Prisma и на живом Postgres (джоба migrations,
// E2E_REAL_DB=1) — подписка лежит зашифрованной, unique по хэшу адреса
// глобальный, перенос к другому аккаунту — upsert, и всё это обязано пройти
// через настоящие констрейнты. Транспорт web-push подменён: в сеть спек не ходит.
import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { runInNewContext } from 'vm';
import { generateVAPIDKeys, sendNotification } from 'web-push';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { AccountService } from '../src/bot/account.service';
import { hashEndpoint } from '../src/push/push-endpoint';
import { PushService } from '../src/push/push.service';
import { signAccessToken } from './e2e-support/jwt';
import {
  cleanupOwnershipFixtures,
  seedUsers,
} from './e2e-support/cleanup-fixtures';

jest.mock('web-push', () => ({
  ...jest.requireActual<typeof import('web-push')>('web-push'),
  sendNotification: jest.fn(),
}));
const send = sendNotification as jest.MockedFunction<typeof sendNotification>;

// Ключи — до сборки приложения: PushService читает их при создании.
const VAPID = generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = VAPID.publicKey;
process.env.VAPID_PRIVATE_KEY = VAPID.privateKey;

const P256DH = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString(
  'base64url',
);
const AUTH = Buffer.alloc(16, 3).toString('base64url');
const ENDPOINT_A = 'https://fcm.googleapis.com/fcm/send/e2e-push-owner-a';
const ENDPOINT_A2 = `${ENDPOINT_A}-rotated`;
const ENDPOINT_A3 = `${ENDPOINT_A}-from-sw`;
const ENDPOINT_EVIL = 'https://fcm.googleapis.com/fcm/send/e2e-push-attacker';

describe('e2e smoke: ownership уведомлений в приложении', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const secret = () => process.env.JWT_SECRET as string;
  const USER_A = 1_000_000_000_000_301n;
  const USER_B = 1_000_000_000_000_302n;
  const ALL = [USER_A, USER_B];
  const tokenA = () => `Bearer ${signAccessToken(USER_A, secret())}`;
  const tokenB = () => `Bearer ${signAccessToken(USER_B, secret())}`;

  const subscribe = (auth: string, endpoint = ENDPOINT_A) =>
    request(app.getHttpServer())
      .post('/api/push/subscription')
      .set('Authorization', auth)
      .send({ endpoint, keys: { p256dh: P256DH, auth: AUTH } });
  const unsubscribe = (auth: string, endpoint = ENDPOINT_A) =>
    request(app.getHttpServer())
      .post('/api/push/unsubscribe')
      .set('Authorization', auth)
      .send({ endpoint, reason: 'user' });
  const settings = async (auth: string) =>
    (
      await request(app.getHttpServer())
        .get('/api/settings')
        .set('Authorization', auth)
    ).body as { notifyChannel: string | null; telegramLinked: boolean };
  const rowsOf = (userId: bigint) =>
    prisma.pushSubscription.findMany({ where: { userId } });
  const known = async (auth: string, endpoint: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/push/status')
        .set('Authorization', auth)
        .send({ endpoint })
    ).body as unknown;
  // Без Authorization — так шлёт воркер сайта: сессии у него нет.
  const rotate = (oldEndpoint: string, endpoint: string) =>
    request(app.getHttpServer())
      .post('/api/push/rotate')
      .send({
        oldEndpoint,
        subscription: { endpoint, keys: { p256dh: P256DH, auth: AUTH } },
      });

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await seedUsers(prisma, ALL);
  });

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('без входа ручки закрыты', async () => {
    const res = await request(app.getHttpServer()).get('/api/push/config');
    expect(res.status).toBe(401);
  });

  it('config отдаёт публичный ключ сервера', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/push/config')
      .set('Authorization', tokenA());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: VAPID.publicKey });
  });

  it('чужой хост, http и битые поля — 400, подписка не сохраняется', async () => {
    for (const endpoint of [
      'https://fcm.googleapis.com.evil.com/x',
      'http://fcm.googleapis.com/fcm/send/x',
      'https://localhost/x',
    ]) {
      expect((await subscribe(tokenA(), endpoint)).status).toBe(400);
    }
    const noKeys = await request(app.getHttpServer())
      .post('/api/push/subscription')
      .set('Authorization', tokenA())
      .send({ endpoint: ENDPOINT_A });
    expect(noKeys.status).toBe(400);
    expect(await rowsOf(USER_A)).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('подписался → пробное уведомление ушло, экран настроек видит канал push (сохранил → нашёл)', async () => {
    const res = await subscribe(tokenA());
    expect(res.status).toBeLessThan(300);
    expect(res.body).toEqual({ ok: true, delivered: true });
    expect(send).toHaveBeenCalledTimes(1);
    const [sub, payload] = send.mock.calls[0];
    expect(sub.endpoint).toBe(ENDPOINT_A);
    expect(JSON.parse(String(payload))).toMatchObject({
      url: '/today',
      tag: 'push_enabled',
    });
    expect(await settings(tokenA())).toMatchObject({
      notifyChannel: 'push',
      notifyReachable: true,
      telegramLinked: false,
    });
  });

  // Фильтр по связи (pushSubscriptions: { some }) фейк не эмулирует — только
  // живой Postgres: веб-аккаунт без Telegram с подпиской попадает в обход
  // планировщика (notifyAudience), иначе ему нечего было бы слать.
  (process.env.E2E_REAL_DB === '1' ? it : it.skip)(
    'подписчик без Telegram попадает в выборку планировщика',
    async () => {
      // Оба приняли условия: B выпадает только из-за адреса, а не согласия.
      await prisma.user.updateMany({
        where: { id: { in: ALL } },
        data: { disclaimerAccepted: true },
      });
      const users = await app.get(AccountService).getAllUsersWithSettings();
      const ids = users.map((u) => u.id);
      expect(ids).toContain(USER_A);
      expect(ids).not.toContain(USER_B);
      // Подписка, записанная ручкой, видна обходу (инсайт из оценок — только сюда).
      expect(users.find((u) => u.id === USER_A)?.hasPush).toBe(true);
    },
  );

  it('чужой endpoint не отписывает: B отписывает адрес A — подписка A на месте', async () => {
    const res = await unsubscribe(tokenB());
    expect(res.status).toBeLessThan(300);
    expect(res.body).toEqual({ ok: true });
    expect(await rowsOf(USER_A)).toHaveLength(1);
    expect((await settings(tokenA())).notifyChannel).toBe('push');
  });

  it('тот же браузер под другим аккаунтом переезжает к нему, второй строки нет', async () => {
    expect((await subscribe(tokenB())).status).toBeLessThan(300);
    expect(await rowsOf(USER_A)).toHaveLength(0);
    expect(await rowsOf(USER_B)).toHaveLength(1);
    expect((await settings(tokenA())).notifyChannel).toBeNull();
    expect((await settings(tokenB())).notifyChannel).toBe('push');
  });

  it('свою подписку человек снимает — канал пропадает', async () => {
    expect((await unsubscribe(tokenB())).status).toBeLessThan(300);
    expect(await rowsOf(USER_B)).toHaveLength(0);
    expect((await settings(tokenB())).notifyChannel).toBeNull();
  });

  it('сверка вкладки: своя подписка известна, чужая и неизвестная — нет, без входа — 401', async () => {
    expect((await subscribe(tokenA())).status).toBeLessThan(300);
    expect(await known(tokenA(), ENDPOINT_A)).toEqual({ known: true });
    expect(await known(tokenB(), ENDPOINT_A)).toEqual({ known: false });
    expect(await known(tokenA(), `${ENDPOINT_A}x`)).toEqual({ known: false });
    const anon = await request(app.getHttpServer())
      .post('/api/push/status')
      .send({ endpoint: ENDPOINT_A });
    expect(anon.status).toBe(401);
  });

  it('ротация без входа: не зная старого адреса, чужую подписку не перехватить — ответ тот же, ничего не меняется', async () => {
    const guesses = [
      `${ENDPOINT_A}x`,
      `${ENDPOINT_A}/`,
      ENDPOINT_A.slice(0, -1),
    ];
    for (const guess of [...guesses, ENDPOINT_A.toUpperCase()]) {
      const res = await rotate(guess, ENDPOINT_EVIL);
      expect([res.status, res.body]).toEqual([200, { ok: true }]);
    }
    expect(await rowsOf(USER_A)).toHaveLength(1);
    expect(await known(tokenA(), ENDPOINT_A)).toEqual({ known: true });
    const evil = { endpointHash: hashEndpoint(ENDPOINT_EVIL) };
    expect(await prisma.pushSubscription.findMany({ where: evil })).toEqual([]);
  });

  it('ротация без входа: известный старый адрес — подписка A на новом адресе, очередь шлёт туда (сохранил → нашёл)', async () => {
    const res = await rotate(ENDPOINT_A, ENDPOINT_A2);
    expect([res.status, res.body]).toEqual([200, { ok: true }]);
    expect(await rowsOf(USER_A)).toHaveLength(1);
    expect(await known(tokenA(), ENDPOINT_A2)).toEqual({ known: true });
    expect(await known(tokenA(), ENDPOINT_A)).toEqual({ known: false });
    expect((await settings(tokenA())).notifyChannel).toBe('push');
    const payload = { title: 't', body: 'b', url: '/today', tag: 'x' };
    await app.get(PushService).sendToUser(USER_A, payload);
    expect(send.mock.calls.map(([to]) => to.endpoint)).toEqual([ENDPOINT_A2]);
  });

  it('ротация: новый адрес не из списка push-сервисов или без ключей — 400, подписка на месте', async () => {
    expect((await rotate(ENDPOINT_A2, 'https://evil.example/x')).status).toBe(
      400,
    );
    const noKeys = await request(app.getHttpServer())
      .post('/api/push/rotate')
      .send({
        oldEndpoint: ENDPOINT_A2,
        subscription: { endpoint: ENDPOINT_A3 },
      });
    expect(noKeys.status).toBe(400);
    expect(await known(tokenA(), ENDPOINT_A2)).toEqual({ known: true });
  });

  // Шов (правило №14): тело собирает настоящий webapp/public/sw.js — без
  // сессии, как в браузере; ручка его принимает и переносит подписку.
  it('sw.js на pushsubscriptionchange доводит новую подписку до сервера', async () => {
    const handlers: Record<string, (e: unknown) => void> = {};
    type Init = {
      method: string;
      headers: Record<string, string>;
      body: string;
    };
    const fetch = async (url: string, init: Init) => {
      expect(init.method).toBe('POST');
      const res = await request(app.getHttpServer())
        .post(url)
        .set(init.headers)
        .send(init.body);
      return { ok: res.ok, status: res.status };
    };
    const addEventListener = (type: string, fn: (e: unknown) => void) => {
      handlers[type] = fn;
    };
    const sw = readFileSync(join(__dirname, '../webapp/public/sw.js'), 'utf8');
    runInNewContext(sw, { self: { addEventListener, fetch }, console });
    const pending: Promise<unknown>[] = [];
    const keys = { p256dh: P256DH, auth: AUTH };
    handlers.pushsubscriptionchange({
      oldSubscription: { endpoint: ENDPOINT_A2 },
      newSubscription: { toJSON: () => ({ endpoint: ENDPOINT_A3, keys }) },
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    });
    await Promise.all(pending);
    expect(await known(tokenA(), ENDPOINT_A3)).toEqual({ known: true });
    expect(await known(tokenA(), ENDPOINT_A2)).toEqual({ known: false });
  });
});
