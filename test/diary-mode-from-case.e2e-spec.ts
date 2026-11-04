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

  // QA 2026-11, К1: «Сохранить» в разборе переписывало портрет режима
  // триггером и порывом одного момента. Разбор живёт записью дневника
  // режимов (сегмент «Случаи»), а в карточку ложится только в пустые поля.
  it('сохранил разбор → карточка режима не изменилась, разбор нашёлся', async () => {
    const card = await agent().post('/api/mode-notes', {
      modeId: 'detached_protector',
      triggers: 'критика начальника, громкие ссоры',
      behavior: 'Ухожу в сериалы на весь вечер',
    });
    expect(card.status).toBe(201);

    const entry = await agent().post('/api/diary/mode', {
      modeId: 'detached_protector',
      situation: 'Подруга не ответила',
      bodyFeelings: 'Страшно, тревожно',
      actions: 'Свернуть разговор',
      fromCase: true,
    });
    expect(entry.status).toBe(201);
    const seed = await agent().post('/api/mode-notes', {
      modeId: 'detached_protector',
      triggers: 'Подруга не ответила',
      feelings: 'Страшно, тревожно',
      behavior: 'Свернуть разговор',
      fillIfEmpty: ['triggers', 'feelings', 'behavior'],
    });
    expect(seed.status).toBe(201);

    const notes = await agent().get('/api/mode-notes');
    const note = notes.body.find(
      (n: { modeId: string }) => n.modeId === 'detached_protector',
    );
    expect(note.triggers).toBe('критика начальника, громкие ссоры');
    expect(note.behavior).toBe('Ухожу в сериалы на весь вечер');
    expect(note.feelings).toBe('Страшно, тревожно');

    const list = await agent().get('/api/diary/mode');
    const saved = list.body.find(
      (e: { situation: string }) => e.situation === 'Подруга не ответила',
    );
    expect(saved).toMatchObject({
      modeId: 'detached_protector',
      fromCase: true,
    });
  });

  it('fillIfEmpty с полем не из карточки — 400', async () => {
    const res = await agent().post('/api/mode-notes', {
      modeId: 'detached_protector',
      triggers: 'т',
      fillIfEmpty: ['userId'],
    });
    expect(res.status).toBe(400);
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
