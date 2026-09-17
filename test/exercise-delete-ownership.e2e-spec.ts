// e2e SMOKE на удаление записей упражнений («Проверка убеждения», «Письмо
// себе», кризисная карточка). До этого PR роуты DELETE /api/belief-checks/:id,
// /api/letters/:id и /api/flashcards/:id существовали, но их никто не звал —
// ни один экран не давал удалить написанное. Теперь кнопка есть в «Моём пути»
// на обеих площадках, то есть роуты стали живым пользовательским путём, и по
// правилу CLAUDE.md («новый контроллер/эндпоинт = e2e-смок на ownership») они
// обязаны иметь проверку через настоящий HTTP-стек.
//
// Юнит-тесты сервиса (src/bot/exercises.service.spec.ts) проверяют WHERE
// userId, но молчат о том, примонтирован ли guard и не приедет ли чужая
// запись/чужое удаление по HTTP. Гоняется дважды: на фейковой Prisma и на
// живом Postgres (джоба migrations, E2E_REAL_DB=1) — тексты в БД лежат
// зашифрованными, и путь «сохранил → удалил → не нашёл» обязан пройти через
// настоящие типы колонок.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import {
  cleanupOwnershipFixtures,
  seedUsers,
} from './e2e-support/cleanup-fixtures';

describe('e2e smoke: удаление записей упражнений (ownership)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const secret = () => process.env.JWT_SECRET as string;
  const USER_A = 1_000_000_000_000_111n;
  const USER_B = 1_000_000_000_000_112n;
  const ALL = [USER_A, USER_B];

  const server = () => app.getHttpServer();
  const tokenA = () => signAccessToken(USER_A, secret());
  const tokenB = () => signAccessToken(USER_B, secret());

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await seedUsers(prisma, ALL);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  // Одна таблица сценария: создать под A → чужой DELETE под B не трогает →
  // свой DELETE под A убирает. Три упражнения проходят один и тот же путь,
  // поэтому он описан данными, а не тремя копиями блока (правило «одна
  // механика — один компонент» в применении к тесту).
  const CASES = [
    {
      name: 'Проверка убеждения',
      path: '/api/belief-checks',
      body: {
        belief: 'убеждение пользователя A',
        evidenceFor: ['за'],
        evidenceAgainst: ['против'],
        reframe: 'иначе',
      },
    },
    {
      name: 'Письмо себе',
      path: '/api/letters',
      body: { text: 'письмо пользователя A' },
    },
    {
      name: 'Кризисная карточка',
      path: '/api/flashcards',
      body: {
        modeId: 'vulnerable_child',
        needId: 'attachment',
        reflection: 'что со мной происходит',
        action: 'что помогает',
      },
    },
  ];

  const ids = (body: unknown): number[] =>
    (body as Array<{ id: number }>).map((r) => r.id);

  for (const c of CASES) {
    it(`«${c.name}»: B не удаляет запись A, а A удаляет свою`, async () => {
      const created = await request(server())
        .post(c.path)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send(c.body);
      expect(created.status).toBeLessThan(300);
      const id = created.body.id as number;
      expect(typeof id).toBe('number');

      // Чужое удаление: отказ либо «ничего не удалилось» — важно, что запись
      // осталась у владельца. Сервис фильтрует deleteMany по (id, userId),
      // поэтому статус может быть и 200 с нулём затронутых строк; проверяем
      // не статус, а факт.
      await request(server())
        .delete(`${c.path}/${id}`)
        .set('Authorization', `Bearer ${tokenB()}`);

      const afterStranger = await request(server())
        .get(c.path)
        .set('Authorization', `Bearer ${tokenA()}`);
      expect(afterStranger.status).toBe(200);
      expect(ids(afterStranger.body)).toContain(id);

      // Своё удаление — запись действительно исчезает из списка владельца.
      const own = await request(server())
        .delete(`${c.path}/${id}`)
        .set('Authorization', `Bearer ${tokenA()}`);
      expect(own.status).toBeLessThan(300);

      const afterOwner = await request(server())
        .get(c.path)
        .set('Authorization', `Bearer ${tokenA()}`);
      expect(afterOwner.status).toBe(200);
      expect(ids(afterOwner.body)).not.toContain(id);
    });
  }

  it('аноним не удаляет ничего — DELETE без токена отбивается guard-ом', async () => {
    const created = await request(server())
      .post('/api/letters')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ text: 'письмо, которое не должен стереть аноним' });
    const id = created.body.id as number;

    const anon = await request(server()).delete(`/api/letters/${id}`);
    expect(anon.status).toBe(401);

    const still = await request(server())
      .get('/api/letters')
      .set('Authorization', `Bearer ${tokenA()}`);
    expect(ids(still.body)).toContain(id);
  });
});
