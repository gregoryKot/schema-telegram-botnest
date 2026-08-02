// e2e SMOKE — вход из мини-приложения MAX через РЕАЛЬНЫЙ AppModule/HTTP-стек
// (build-test-app.ts, как у app-auth/app-ownership). Правило проекта: новый
// контроллер/эндпоинт приезжает со смоуком на ownership.
//
// Что тут проверяется и почему юнит-тестами не закрывается:
//   1. `POST /api/auth/max/webapp` реально примонтирован и меняет подпись MAX
//      на сессию (юнит-тест контроллера не поймал бы «роут не зарегистрирован»);
//   2. пользователь MAX получает userId из веб-диапазона, а НЕ равный своему
//      id в мессенджере. Иначе MAX-аккаунт с id 777 сел бы на данные
//      телеграмного пользователя 777 — это чужая переписка, а не «мелкий баг»;
//   3. ownership: два пользователя MAX не видят карточки друг друга;
//   4. третий путь TelegramAuthGuard: заголовок `x-max-init-data` пускает в
//      обычный эндпоинт на самом первом запросе, пока сессии ещё нет.
//
// Эндпоинт троттлится (5 запросов в минуту), поэтому логинов на весь файл
// ровно три: два в beforeAll и один на поддельную подпись.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';

/** Диапазон web-only идентификаторов из AuthService (WEB_USER_ID_MIN/MAX). */
const WEB_USER_ID_MIN = 1_000_000_000_000_000n;
const WEB_USER_ID_MAX = 9_000_000_000_000_000n;

/**
 * Повторяет валидацию из src/auth/max-init-data.ts: подпись считается по
 * ДЕКОДИРОВАННЫМ значениям, отсортированным по ключу, а по проводу значения
 * уходят в URL-кодировке. Тест подписывает данные сам — так он проверяет
 * алгоритм, а не заранее подогнанную строку.
 */
function buildMaxInitData(
  id: number,
  botToken: string,
  overrides: Record<string, string> = {},
): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: '4c0ab423-342b-4e45-aea4-2747dbc500cd',
    chat: JSON.stringify({ id: 12345, type: 'DIALOG' }),
    user: JSON.stringify({ id, first_name: 'E2E MAX', username: null }),
    ...overrides,
  };
  const launchParams = Object.keys(fields)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(launchParams)
    .digest('hex');
  const pairs = Object.entries(fields).map(
    ([k, v]) => `${k}=${encodeURIComponent(v)}`,
  );
  pairs.push(`hash=${hash}`);
  return pairs.join('&');
}

describe('e2e smoke: вход из мини-приложения MAX (max-auth)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  // id пользователей В МЕССЕНДЖЕРЕ MAX — намеренно маленькие числа из
  // телеграмного диапазона: так видно, что userId ими не становится.
  const MAX_USER_A = 777;
  const MAX_USER_B = 778;

  let tokenA = '';
  let tokenB = '';

  const maxBotToken = () => process.env.MAX_BOT_TOKEN as string;

  const exchange = (initData: string) =>
    request(app.getHttpServer())
      .post('/api/auth/max/webapp')
      .set('x-requested-with', 'miniapp')
      .send({ initData });

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());

    const resA = await exchange(buildMaxInitData(MAX_USER_A, maxBotToken()));
    expect(resA.status).toBe(200);
    tokenA = resA.body.accessToken as string;

    const resB = await exchange(buildMaxInitData(MAX_USER_B, maxBotToken()));
    expect(resB.status).toBe(200);
    tokenB = resB.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('подпись MAX меняется на сессию: access-токен и refresh-кука', () => {
    expect(tokenA).toBeTruthy();
    expect(tokenB).toBeTruthy();
    expect(tokenA).not.toBe(tokenB);
  });

  it('провайдер записан как max, а не telegram', () => {
    const rows = prisma.authProvider._rows.filter(
      (r: { provider: string }) => r.provider === 'max',
    );
    expect(rows).toHaveLength(2);
    expect(
      rows.map((r: { providerId: string }) => r.providerId).sort(),
    ).toEqual(['777', '778']);
  });

  it('userId берётся из веб-диапазона, а не равен id пользователя в MAX', () => {
    const rows = prisma.authProvider._rows.filter(
      (r: { provider: string }) => r.provider === 'max',
    );
    for (const row of rows as { userId: bigint; providerId: string }[]) {
      // Ключевая проверка: id 777 в MAX НЕ становится userId 777 — иначе
      // аккаунт сел бы на данные телеграмного пользователя с тем же числом.
      expect(row.userId).not.toBe(BigInt(row.providerId));
      expect(row.userId >= WEB_USER_ID_MIN).toBe(true);
      expect(row.userId < WEB_USER_ID_MAX).toBe(true);
    }
  });

  it('пользователь B не видит карточки пользователя A', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/schema-notes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ schemaId: 'abandonment', triggers: 'секрет пользователя A' });
    expect(create.status).toBeLessThan(300);

    const asOwner = await request(app.getHttpServer())
      .get('/api/schema-notes')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body).toHaveLength(1);

    const asOther = await request(app.getHttpServer())
      .get('/api/schema-notes')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(asOther.status).toBe(200);
    expect(asOther.body).toHaveLength(0);
  });

  it('заголовок x-max-init-data пускает в обычный эндпоинт без сессии', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/schema-notes')
      .set('x-max-init-data', buildMaxInitData(MAX_USER_A, maxBotToken()));
    expect(res.status).toBe(200);
    // Тот же пользователь, что логинился подписью: карточка из теста выше
    // видна, значит guard привёл заголовок к тому же userId, а не завёл новый.
    expect(res.body).toHaveLength(1);
    expect(res.body[0].schemaId).toBe('abandonment');
  });

  it('поддельная подпись не пускает и в guard, и в эндпоинт обмена', async () => {
    const valid = buildMaxInitData(MAX_USER_A, maxBotToken());
    // Меняем имя ПОСЛЕ подписи — hash остаётся от исходных данных.
    const tampered = valid.replace(
      encodeURIComponent('E2E MAX'),
      encodeURIComponent('Злоумышленник'),
    );
    expect(tampered).not.toBe(valid);

    const viaGuard = await request(app.getHttpServer())
      .get('/api/schema-notes')
      .set('x-max-init-data', tampered);
    expect(viaGuard.status).toBe(401);

    const viaExchange = await exchange(tampered);
    expect(viaExchange.status).toBe(401);
  });
});
