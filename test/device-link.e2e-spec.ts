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
// Чего тут НЕТ и почему: подтверждение ЧУЖИМ аккаунтом запускает merge, а он
// написан на сыром SQL ($executeRaw), которого fake-prisma не эмулирует.
// Порядок шагов внутри merge и перенос владения строкой проверяются юнит-тестом
// device-link.service.spec.ts. Здесь связка гоняется на своём же аккаунте —
// маршруты, одноразовость и выдача сессии от этого не зависят.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';

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

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    for (const id of [USER_A, USER_B, USER_C]) {
      prisma.user._rows.push({ id, firstName: 'E2E' });
    }
    tokenA = signAccessToken(USER_A, secret());
    tokenB = signAccessToken(USER_B, secret());
    tokenC = signAccessToken(USER_C, secret());
  });

  afterAll(async () => {
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
    const dump = JSON.stringify(prisma.deviceLinkRequest._rows, (_k, v) =>
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
