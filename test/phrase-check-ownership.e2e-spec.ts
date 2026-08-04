// e2e SMOKE упражнения «Разобрать фразу» (правило CLAUDE.md: новый
// контроллер = e2e-смок на ownership). Юнит-тесты сервиса проверяют WHERE
// userId, но не отвечают на вопросы «guard примонтирован?», «ValidationPipe
// применён глобально?» и «чужой разбор точно не приедет в HTTP-ответе?».
//
// Гоняется дважды: на фейковой Prisma и на живом Postgres (джоба migrations,
// E2E_REAL_DB=1) — фраза в БД лежит зашифрованной, и путь «сохранил → нашёл»
// обязан пройти через настоящие типы колонок, а не только через фейк.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e smoke: ownership упражнения «Разобрать фразу»', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const secret = () => process.env.JWT_SECRET as string;
  const USER_A = 1_000_000_000_000_101n;
  const USER_B = 1_000_000_000_000_102n;
  const ALL = [USER_A, USER_B];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('B не видит разбор A, а сам A получает его целым (сохранил → нашёл)', async () => {
    const tokenA = signAccessToken(USER_A, secret());
    const tokenB = signAccessToken(USER_B, secret());

    const created = await request(app.getHttpServer())
      .post('/api/phrase-checks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        phrase: 'ни на что не гожусь — фраза пользователя A',
        marks: ['person', 'shame'],
        rewrite: 'отчёт вышел с ошибкой, проверю цифры дважды',
      });
    expect(created.status).toBeLessThan(300);

    const asOwner = await request(app.getHttpServer())
      .get('/api/phrase-checks')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body).toHaveLength(1);
    expect(asOwner.body[0].phrase).toContain('фраза пользователя A');
    expect(asOwner.body[0].marks).toEqual(['person', 'shame']);

    const asStranger = await request(app.getHttpServer())
      .get('/api/phrase-checks')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(asStranger.status).toBe(200);
    expect(asStranger.body).toEqual([]);
  });

  it('чужой разбор не удаляется по id', async () => {
    const tokenA = signAccessToken(USER_A, secret());
    const tokenB = signAccessToken(USER_B, secret());

    const created = await request(app.getHttpServer())
      .post('/api/phrase-checks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ phrase: 'вторая фраза A', marks: [] });
    const id = created.body.id;

    await request(app.getHttpServer())
      .delete(`/api/phrase-checks/${id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    const stillThere = await request(app.getHttpServer())
      .get('/api/phrase-checks')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(stillThere.body.map((r: { id: number }) => r.id)).toContain(id);
  });

  it('анонима не пускают, выдуманная примета отбивается ValidationPipe', async () => {
    const anon = await request(app.getHttpServer()).get('/api/phrase-checks');
    expect(anon.status).toBe(401);

    const bad = await request(app.getHttpServer())
      .post('/api/phrase-checks')
      .set('Authorization', `Bearer ${signAccessToken(USER_A, secret())}`)
      .send({ phrase: 'фраза', marks: ['выдумка'] });
    expect(bad.status).toBe(400);
  });
});
