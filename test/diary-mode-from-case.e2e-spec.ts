// Простой клиент, этап 4: запись режима из потока «Что случилось» помечена
// `fromCase` — по ней «Записи» строят фильтр «Случаи», а /stats считает
// разборы. Связка «сохранил → нашёл» идёт через настоящий AppModule и
// ValidationPipe (поле проходит DTO, иначе whitelist его срежет), на живом
// Postgres гоняется вторым разом в джобе `migrations`.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e: дневник режимов — маркер fromCase', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const U = 4_200_000_000_000_031n;

  function agent() {
    const token = signAccessToken(U, process.env.JWT_SECRET as string);
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(request(app.getHttpServer()).get(url)),
      post: (url: string, body: object = {}) =>
        auth(request(app.getHttpServer()).post(url)).send(body),
    };
  }

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, [U]);
    await prisma.user.create({ data: { id: U } });
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, [U]);
    await app.close();
  });

  it('fromCase: true возвращается в GET; запись без поля — false', async () => {
    const withCase = await agent().post('/api/diary/mode', {
      modeId: 'vulnerable_child',
      situation: 'тишина в ответ',
      fromCase: true,
    });
    expect(withCase.status).toBe(201);
    const plain = await agent().post('/api/diary/mode', {
      modeId: 'healthy_adult',
      situation: 'обычная запись',
    });
    expect(plain.status).toBe(201);

    const list = await agent().get('/api/diary/mode');
    const bySituation = (s: string) =>
      list.body.find((e: { situation: string }) => e.situation === s);
    expect(bySituation('тишина в ответ').fromCase).toBe(true);
    expect(bySituation('обычная запись').fromCase).toBe(false);
  });

  it('fromCase не булево — 400', async () => {
    const res = await agent().post('/api/diary/mode', {
      modeId: 'vulnerable_child',
      situation: 'с',
      fromCase: 'да',
    });
    expect(res.status).toBe(400);
  });
});
