// e2e SMOKE уведомлений в приложении (правило: новый контроллер = e2e-смок на
// ownership). Юнит-спеки PushService проверяют where по userId и исходы
// отправки, но не отвечают на «guard примонтирован?», «DTO валидирует тело?»,
// «чужой endpoint не удаляет чужую подписку?» и «экран настроек видит тот же
// канал, что выберет очередь?» (сохранил → нашёл).
//
// Гоняется дважды: на фейковой Prisma и на живом Postgres (джоба migrations,
// E2E_REAL_DB=1) — подписка лежит зашифрованной, unique по хэшу адреса
// глобальный, перенос к другому аккаунту — upsert, и всё это обязано пройти
// через настоящие констрейнты. Транспорт web-push подменён: в сеть спек не ходит.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { generateVAPIDKeys, sendNotification } from 'web-push';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { AccountService } from '../src/bot/account.service';
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
      const users = await app.get(AccountService).getAllUsersWithSettings();
      const ids = users.map((u) => u.id);
      expect(ids).toContain(USER_A);
      expect(ids).not.toContain(USER_B);
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
});
