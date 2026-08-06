// e2e SMOKE — привязка аккаунта мессенджера к уже существующему (RFC 8628)
// через РЕАЛЬНЫЙ AppModule/HTTP-стек. Правило проекта: новый контроллер
// приезжает со смоуком на ownership.
//
// Что проверяется и почему юнит-тестами не закрывается:
//   1. четыре маршрута реально примонтированы (юнит-тест контроллера не ловит
//      «роут не зарегистрирован») и работают в связке;
//   2. ownership: код, выданный пользователю А, невозможно ни подсмотреть, ни
//      подтвердить, ни опросить чужим — а это и есть цена ошибки здесь, потому
//      что подтверждение отдаёт ВСЕ данные одного аккаунта другому;
//   3. подтверждать может только залогиненный: без токена approve обязан
//      отвечать 401, иначе достаточно угадать короткий код.
//
// Про подтверждение ЧУЖИМ аккаунтом. Оно запускает merge, а тот написан на
// сыром SQL ($executeRaw), которого fake-prisma не эмулирует. Поэтому блок
// «перенос между разными аккаунтами» гоняется ТОЛЬКО на живом Postgres
// (E2E_REAL_DB=1, джоба `migrations`) — на фейке он честно помечен skipped,
// а не тихо отсутствует. Остальное работает в обоих режимах.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

// Перенос данных проверяется только там, где merge реально исполняется.
const REAL_DB = process.env.E2E_REAL_DB === '1';
const describeOnRealDb = REAL_DB ? describe : describe.skip;

describe('e2e smoke: привязка аккаунта из мессенджера (device-link)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const USER_A = 700_000_000_000_001n; // «аккаунт в мессенджере», источник
  const USER_B = 700_000_000_000_002n; // посторонний
  const USER_C = 700_000_000_000_003n; // хозяин целевого аккаунта

  let tokenA = '';
  let tokenB = '';
  let tokenC = '';
  const secret = () => process.env.JWT_SECRET as string;

  // Адрес пишется литералом прямо у `.post(` — трипваер покрытия маршрутов
  // (src/security/e2e-route-coverage.invariants.spec.ts) ищет вызовы грепом
  // по исходникам e2e и собранный из кусков путь не увидит.
  const srv = () => request(app.getHttpServer());
  const call = (req: request.Test, token?: string) =>
    (token ? req.set('Authorization', `Bearer ${token}`) : req).set(
      'x-requested-with',
      'webapp',
    );

  const ALL_USER_IDS = [USER_A, USER_B, USER_C];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    // upsert, а не push в _rows: на живом Postgres строка User обязана
    // существовать — у DeviceLinkRequest на неё внешний ключ.
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    for (const id of ALL_USER_IDS) {
      await prisma.user.upsert({
        where: { id },
        update: {},
        create: { id, firstName: 'E2E' },
      });
    }
    tokenA = signAccessToken(USER_A, secret());
    tokenB = signAccessToken(USER_B, secret());
    tokenC = signAccessToken(USER_C, secret());
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await app.close();
  });

  async function startFor(token: string) {
    const res = await call(
      srv().post('/api/auth/device-link/start'),
      token,
    ).send({
      provider: 'max',
    });
    expect(res.status).toBe(200);
    return res.body as { deviceCode: string; userCode: string };
  }

  it('start отдаёт два разных кода и не кладёт их в базу открытым текстом', async () => {
    const { deviceCode, userCode } = await startFor(tokenA);

    expect(deviceCode).toHaveLength(64);
    expect(userCode).toHaveLength(8);
    // findMany, а не приватные _rows фейка: тот же тест обязан работать и на
    // живом Postgres (E2E_REAL_DB=1), где никаких _rows нет.
    const rows = await prisma.deviceLinkRequest.findMany({});
    const dump = JSON.stringify(rows, (_k, v) =>
      typeof v === 'bigint' ? String(v) : (v as unknown),
    );
    expect(dump).not.toContain(deviceCode);
    expect(dump).not.toContain(userCode);
  });

  it('без токена подтвердить нельзя — иначе хватило бы угадать код', async () => {
    const { userCode } = await startFor(tokenA);

    const res = await call(srv().post('/api/auth/device-link/approve')).send({
      code: userCode,
    });
    expect(res.status).toBe(401);
  });

  it('чужой код не подсматривается: preview на выдуманный код — отказ', async () => {
    const res = await call(
      srv().post('/api/auth/device-link/preview'),
      tokenB,
    ).send({
      code: 'ZZZZ9999',
    });
    expect(res.status).toBe(400);
  });

  it('мусорный код не доходит до базы — DTO отсекает по форме', async () => {
    const res = await call(
      srv().post('/api/auth/device-link/preview'),
      tokenB,
    ).send({
      code: 'нет',
    });
    expect(res.status).toBe(400);
  });

  it('опрос чужим (коротким) кодом сессии не выдаёт', async () => {
    const { userCode } = await startFor(tokenA);

    // Длина не та — DTO отсекает раньше базы, но проверяем именно результат:
    // сессии по короткому коду не бывает ни при каком раскладе.
    const res = await call(srv().post('/api/auth/device-link/poll')).send({
      deviceCode: userCode.repeat(8),
    });
    expect(res.body.accessToken).toBeUndefined();
  });

  it('посторонний видит по коду, ЧТО подтверждает, — иначе флоу открыт для уговоров', async () => {
    const { userCode } = await startFor(tokenA);

    const preview = await call(
      srv().post('/api/auth/device-link/preview'),
      tokenC,
    ).send({
      code: userCode,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.sameAccount).toBe(false);
    expect(preview.body).toHaveProperty('summary');
  });

  it('связка целиком: начал → подтвердил → забрал сессию, и ровно один раз', async () => {
    const { deviceCode, userCode } = await startFor(tokenA);

    const pending = await call(srv().post('/api/auth/device-link/poll')).send({
      deviceCode,
    });
    expect(pending.body).toEqual({ status: 'pending' });

    const approve = await call(
      srv().post('/api/auth/device-link/approve'),
      tokenA,
    ).send({
      code: userCode,
    });
    expect(approve.status).toBe(200);
    expect(approve.body).toEqual({ merged: false });

    const linked = await call(srv().post('/api/auth/device-link/poll')).send({
      deviceCode,
    });
    expect(linked.status).toBe(200);
    expect(linked.body.status).toBe('linked');
    expect(linked.body.accessToken).toBeTruthy();

    // Повторный опрос по тому же коду второй сессии не даёт.
    const again = await call(srv().post('/api/auth/device-link/poll')).send({
      deviceCode,
    });
    expect(again.body).toEqual({ status: 'expired' });
  });
});

// ── Перенос между РАЗНЫМИ аккаунтами (только живой Postgres) ────────────────
describeOnRealDb('перенос данных при подтверждении чужим аккаунтом', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  // Свои идентификаторы: спек выше гоняется в том же процессе и чистит свои.
  const FROM = 700_000_000_000_011n; // аккаунт мессенджера, отдаёт данные
  const TO = 700_000_000_000_012n; // аккаунт с сайта, принимает
  const ALL = [FROM, TO];
  const secret = () => process.env.JWT_SECRET as string;

  const srv = () => request(app.getHttpServer());
  const call = (req: request.Test, token?: string) =>
    (token ? req.set('Authorization', `Bearer ${token}`) : req).set(
      'x-requested-with',
      'webapp',
    );

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    for (const id of ALL) {
      await prisma.user.upsert({
        where: { id },
        update: {},
        create: { id, firstName: 'E2E' },
      });
    }
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('данные уезжают к подтвердившему, исходный аккаунт исчезает, сессия — на нового хозяина', async () => {
    // В аккаунте мессенджера есть что переносить.
    await prisma.rating.create({
      data: { userId: FROM, date: '2026-08-01', needId: 'safety', value: 7 },
    });
    // И запись о самом мессенджере — её привязка обязана переехать тоже,
    // иначе следующий вход из MAX заведёт третий аккаунт заново.
    await prisma.authProvider.create({
      data: { userId: FROM, provider: 'max', providerId: 'e2e-max-777' },
    });

    const started = await call(
      srv().post('/api/auth/device-link/start'),
      signAccessToken(FROM, secret()),
    ).send({ provider: 'max' });
    expect(started.status).toBe(200);
    const { deviceCode, userCode } = started.body as {
      deviceCode: string;
      userCode: string;
    };

    // Экран подтверждения показывает, что именно переедет.
    const preview = await call(
      srv().post('/api/auth/device-link/preview'),
      signAccessToken(TO, secret()),
    ).send({ code: userCode });
    expect(preview.status).toBe(200);
    expect(preview.body.sameAccount).toBe(false);
    expect(preview.body.summary.Rating).toBe(1);

    const approve = await call(
      srv().post('/api/auth/device-link/approve'),
      signAccessToken(TO, secret()),
    ).send({ code: userCode });
    expect(approve.status).toBe(200);
    expect(approve.body).toEqual({ merged: true });

    // Оценка переехала, исходный аккаунт удалён.
    const moved = await prisma.rating.findMany({ where: { userId: TO } });
    expect(moved).toHaveLength(1);
    expect(await prisma.rating.findMany({ where: { userId: FROM } })).toEqual(
      [],
    );
    expect(await prisma.user.findUnique({ where: { id: FROM } })).toBeNull();

    // Провайдер мессенджера теперь принадлежит принявшему аккаунту.
    const provider = await prisma.authProvider.findFirst({
      where: { provider: 'max', providerId: 'e2e-max-777' },
    });
    expect(String(provider?.userId)).toBe(String(TO));

    // И мини-апп, вернувшись за сессией, её получает — несмотря на то, что
    // аккаунт, под которым он начинал, уже не существует.
    const linked = await call(srv().post('/api/auth/device-link/poll')).send({
      deviceCode,
    });
    expect(linked.status).toBe(200);
    expect(linked.body.status).toBe('linked');
    expect(linked.body.accessToken).toBeTruthy();
  });
});
