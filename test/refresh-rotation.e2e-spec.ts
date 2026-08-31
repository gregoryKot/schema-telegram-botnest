// e2e SMOKE — ротация refresh через РЕАЛЬНЫЙ HTTP-стек и настоящие куки.
//
// Гоняется дважды: на фейковой Prisma (джоба `backend`) и на живом Postgres
// (`E2E_REAL_DB=1`, джоба `migrations`). Второе здесь важнее обычного: вся
// починка держится на транзакции, которая гасит прежнего наследника и
// перенацеливает `replacedByHash` — фейк такую семантику может изобразить и
// при сломанном SQL (правило проекта: фейк трижды расходился с реальной БД
// при зелёных тестах).
//
// Что проверяется и почему юнит-тестами не закрывается: юнит знает про
// вердикт, но не про то, доедет ли выданная взамен кука до клиента и примет
// ли её сервер следующим запросом.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { LoginTicketService } from '../src/auth/login-ticket/login-ticket.service';

describe('e2e smoke: ротация refresh — потерянный ответ против кражи', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const USER = 720_000_000_000_001n;
  const ALL_USER_IDS = [USER];

  // Адрес пишется литералом прямо у `.post(` — трипваер покрытия маршрутов
  // (src/security/e2e-route-coverage.invariants.spec.ts) ищет вызовы грепом.
  const srv = () => request(app.getHttpServer());
  const refresh = (cookie: string) =>
    srv()
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${cookie}`)
      .set('x-requested-with', 'webapp');

  /** Значение refresh-куки из ответа. */
  function cookieFrom(res: request.Response): string {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    const line = (raw ?? []).find((c) => c.startsWith('refresh_token='));
    return line ? line.split(';')[0].split('=')[1] : '';
  }

  /**
   * Отматывает возраст всех строк семьи назад: ротация throttl-ится
   * REFRESH_ROTATE_MIN_INTERVAL_MS (5 минут), и без этого на живой базе,
   * где `createdAt` реально проставлен, ни одна ротация в тесте бы не
   * случилась — сервер отдавал бы только новый access. Фейковая Prisma
   * `createdAt` не проставляет вовсе, так что расхождение видно только здесь.
   */
  async function agePast(family: string): Promise<void> {
    await prisma.webSession.updateMany({
      where: { family },
      data: { createdAt: new Date(Date.now() - 10 * 60_000) },
    });
  }

  /** Свежая сессия через настоящий вход: строки WebSession делает сервер. */
  async function login(): Promise<{ cookie: string; family: string }> {
    const res = await srv()
      .post('/api/auth/ticket/start')
      .set('x-requested-with', 'webapp')
      .send({ intent: 'login', provider: 'telegram' });
    expect(res.status).toBe(200);
    const { deviceCode, userCode } = res.body as {
      deviceCode: string;
      userCode: string;
    };
    await app.get(LoginTicketService).approveLogin(userCode, USER);
    const polled = await srv()
      .post('/api/auth/ticket/poll')
      .set('x-requested-with', 'webapp')
      .send({ deviceCode });
    expect(polled.body.status).toBe('linked');
    const cookie = cookieFrom(polled);
    const seed = await prisma.webSession.findUnique({
      where: { tokenHash: createHash('sha256').update(cookie).digest('hex') },
    });
    return { cookie, family: seed!.family as string };
  }

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await prisma.user.upsert({
      where: { id: USER },
      update: {},
      create: { id: USER, firstName: 'E2E' },
    });
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await app.close();
  });

  it('ответ ротации не доехал — прежняя кука впускает, а не выкидывает', async () => {
    const { cookie: first, family } = await login();

    // Ротация прошла на сервере, но Set-Cookie до клиента не добрался: ОС
    // усыпила приложение. Клиент возвращается с ПРЕЖНЕЙ кукой.
    await agePast(family);
    await refresh(first);
    await agePast(family);
    const recovered = await refresh(first);

    expect(recovered.status).toBe(200);
    expect(recovered.body.accessToken).toEqual(expect.any(String));
    const reissued = cookieFrom(recovered);
    expect(reissued).toBeTruthy();
    expect(reissued).not.toBe(first);
    // Выданная взамен кука рабочая — связка «выдали → приняли».
    expect((await refresh(reissued)).status).toBe(200);
  });

  it('ответ терялся дважды подряд — вход всё равно не потерян', async () => {
    const { cookie: first, family } = await login();
    for (let i = 0; i < 2; i++) {
      await agePast(family);
      await refresh(first);
    }
    await agePast(family);
    expect((await refresh(first)).status).toBe(200);
  });

  it('наследником воспользовались — повтор старого токена отзывает всю семью', async () => {
    const { cookie: first, family } = await login();
    await agePast(family);
    const second = cookieFrom(await refresh(first));
    // Легитимный клиент продолжил цепочку: наследник до него дошёл.
    await agePast(family);
    const third = cookieFrom(await refresh(second));

    expect((await refresh(first)).status).toBe(401);
    // Отзывается вся семья, включая честно выданный последний токен.
    expect((await refresh(third)).status).toBe(401);
  });

  it('в семье остаётся ровно один живой токен после восстановления', async () => {
    const { cookie: first, family } = await login();
    // Считаем в пределах СВОЕЙ цепочки: у пользователя есть и сессии, заведённые
    // соседними тестами, и они к этой проверке отношения не имеют.
    await agePast(family);
    await refresh(first);
    await agePast(family);
    await refresh(first);

    const live = await prisma.webSession.findMany({
      where: { userId: USER, family, revokedAt: null },
    });
    // Два живых токена в одной цепочке — ровно то состояние, которое
    // детекция обязана ловить; восстановление не имеет права его создавать.
    expect(live).toHaveLength(1);
  });

  it('гонка: два рефреша одной живой куки → один наследник, а не два', async () => {
    // Две вкладки (или сайт + установленное PWA на одной куке) рефрешат
    // ОДНОВРЕМЕННО. Раньше безусловный update гасил родителя в обеих
    // транзакциях, и обе создавали наследника — два живых токена в семье.
    // Теперь claim идёт через updateMany с `revokedAt: null`: на живом
    // Postgres READ COMMITTED сериализует их, проигравший получает count 0 и
    // наследника не плодит (разбор 2026-08-31).
    const { cookie: first, family } = await login();
    await agePast(family);

    const [a, b] = await Promise.all([refresh(first), refresh(first)]);

    // Никого не выкинули: проигравший гонку получил свежий access, а не 401.
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // ГЛАВНЫЙ инвариант, на обоих движках: в семье РОВНО ОДИН живой токен.
    // На живом Postgres его держит atomic-claim (проигравший видит count 0 и
    // наследника не плодит); фейк ту же гонку изобразить не может (общий объект
    // строки, однопоточность) и сходится к одному живому иначе — через recover,
    // — но инвариант обязан выполняться и там.
    const live = await prisma.webSession.findMany({
      where: { userId: USER, family, revokedAt: null },
    });
    expect(live).toHaveLength(1);
    // Живая кука рабочая — связка «выдали → приняли» не порвалась гонкой.
    const newest = [cookieFrom(a), cookieFrom(b)]
      .filter((c) => c && c !== first)
      .pop();
    expect(newest).toBeTruthy();
    expect((await refresh(newest as string)).status).toBe(200);
  });
});
