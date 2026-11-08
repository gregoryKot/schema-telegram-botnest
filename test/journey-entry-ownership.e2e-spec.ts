// R6 (аудит 2026-11): «Мой путь» перечисляет до 500 записей, а открывал их
// поиском в списке, который отдаёт только 30 последних (тест на схемы — 20):
// 31-я запись открывалась пустой. Теперь у каждой открываемой сущности есть
// GET …/:id, а «Записи» догружают дневник страницами (GET /api/diary/page/:kind).
// Здесь — ownership через настоящий HTTP-стек (правило «новый эндпоинт = e2e
// на ownership»): A открывает свою запись, B по тому же id получает 404, а
// чужой курсор страницы — тоже 404. Гоняется на фейковой Prisma и на живом
// Postgres (джоба `migrations`): там записи лежат шифротекстом.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import {
  cleanupOwnershipFixtures,
  seedUsers,
} from './e2e-support/cleanup-fixtures';
import { DiaryService } from '../src/bot/diary.service';

describe('e2e smoke: запись «Моего пути» по id и страницы дневника (ownership)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const USER_A = 1_000_000_000_000_961n;
  const USER_B = 1_000_000_000_000_962n;
  const ALL = [USER_A, USER_B];

  const as = (user: bigint) => {
    const token = signAccessToken(user, process.env.JWT_SECRET as string);
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(request(app.getHttpServer()).get(url)),
      post: (url: string, body: object) =>
        auth(request(app.getHttpServer()).post(url)).send(body),
    };
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await seedUsers(prisma, ALL);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  // Сущность → как её создать, как открыть по id (литералом пути: его ищет
  // трипваер e2e-route-coverage) и какое поле доказывает, что пришла она.
  type Agent = ReturnType<typeof as>;
  // Тело ответа читаем по известным полям — без any (правило №9).
  type Body = { [k: string]: unknown } & {
    items?: unknown[];
    schemaIds?: unknown[];
  };
  const CASES = [
    {
      path: '/api/diary/schema',
      open: (u: Agent, id: number) => u.get(`/api/diary/schema/${id}`),
      body: { trigger: 'триггер A', emotions: [], schemaIds: ['mistrust'] },
      check: (b: Body) =>
        b.trigger === 'триггер A' && b.schemaIds[0] === 'mistrust',
    },
    {
      path: '/api/diary/mode',
      open: (u: Agent, id: number) => u.get(`/api/diary/mode/${id}`),
      body: { modeId: 'vulnerable_child', situation: 'ситуация A' },
      check: (b: Body) => b.situation === 'ситуация A',
    },
    {
      path: '/api/diary/gratitude',
      open: (u: Agent, id: number) => u.get(`/api/diary/gratitude/${id}`),
      body: { date: '2026-03-01', items: ['солнце A'] },
      check: (b: Body) => b.items[0] === 'солнце A',
    },
    {
      path: '/api/belief-checks',
      open: (u: Agent, id: number) => u.get(`/api/belief-checks/${id}`),
      body: { belief: 'убеждение A', evidenceFor: ['за'], evidenceAgainst: [] },
      check: (b: Body) => b.belief === 'убеждение A',
    },
    {
      path: '/api/letters',
      open: (u: Agent, id: number) => u.get(`/api/letters/${id}`),
      body: { text: 'письмо A' },
      check: (b: Body) => b.text === 'письмо A',
    },
    {
      path: '/api/flashcards',
      open: (u: Agent, id: number) => u.get(`/api/flashcards/${id}`),
      body: {
        modeId: 'vulnerable_child',
        needId: 'attachment',
        action: 'дышать A',
      },
      check: (b: Body) => b.action === 'дышать A',
    },
  ];

  for (const c of CASES) {
    it(`${c.path}/:id — A читает свою запись, B получает 404`, async () => {
      const created = await as(USER_A).post(c.path, c.body);
      expect(created.status).toBe(201);
      const id = created.body.id as number;

      const A = as(USER_A);
      const own = await c.open(A, id);
      expect(own.status).toBe(200);
      expect(c.check(own.body)).toBe(true);

      expect((await c.open(as(USER_B), id)).status).toBe(404);
      expect((await c.open(A, 2147483647)).status).toBe(404);
      expect((await c.open(A, 2147483648)).status).toBe(400);
    });
  }

  it('/api/ysq-history/:id — A видит счёт своей попытки, B получает 404', async () => {
    const answers = Array(116).fill(6);
    expect((await as(USER_A).post('/api/ysq-result', { answers })).status).toBe(
      201,
    );
    const [attempt] = (await as(USER_A).get('/api/ysq-history')).body;

    const own = await as(USER_A).get(`/api/ysq-history/${attempt.id}`);
    expect(own.status).toBe(200);
    expect(own.body).toEqual(attempt);
    expect(own.body.scores.length).toBeGreaterThan(0);
    expect(
      (await as(USER_B).get(`/api/ysq-history/${attempt.id}`)).status,
    ).toBe(404);
  });

  it('сохранил 31 запись → 1-я открывается по id, страницы делят дневник без потерь', async () => {
    const diary = app.get(DiaryService);
    await prisma.schemaDiaryEntry.deleteMany({ where: { userId: USER_A } });
    const ids: number[] = [];
    for (let i = 1; i <= 31; i++) {
      const e = await diary.createSchemaDiaryEntry(USER_A, {
        trigger: `запись ${i}`,
        emotions: [],
        schemaIds: [],
      });
      ids.push(e.id);
    }

    const first = await as(USER_A).get(`/api/diary/schema/${ids[0]}`);
    expect(first.body.trigger).toBe('запись 1');

    const kind = 'schema';
    const page1 = await as(USER_A).get(`/api/diary/page/${kind}`);
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(30);
    expect(page1.body.hasMore).toBe(true);
    const last = page1.body.items[29].id as number;
    const page2 = await as(USER_A).get(`/api/diary/page/schema?before=${last}`);
    expect(page2.body).toMatchObject({ hasMore: false });
    expect(page2.body.items.map((e: Body) => e.trigger)).toEqual(['запись 1']);

    // Чужой курсор: B не узнаёт по ответу ни записей A, ни их существования.
    const stranger = await as(USER_B).get(
      `/api/diary/page/schema?before=${last}`,
    );
    expect(stranger.status).toBe(404);
    const own = await as(USER_B).get('/api/diary/page/schema');
    expect(own.body).toEqual({ items: [], hasMore: false });
    expect((await as(USER_A).get('/api/diary/page/notes')).status).toBe(400);
  });
});
