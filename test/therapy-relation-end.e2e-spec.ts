// e2e: связь клиент↔терапевт заканчивается — что видит клиент и что теряет
// терапевт (решение владельца 2026-11-05, docs/open/therapy.md закрыт этим
// спеком). До решения связь удалялась молча: «Мой терапевт» показывал форму
// кода, будто терапевта не было, а задания бывшего терапевта висели с меткой
// «От терапевта» и всплывали у него после повторного подключения.
//
// Теперь (end-client-relations.ts): связь — `ended` с причиной, клиент видит
// строку о бывшем терапевте (GET /api/therapy/former-therapist), открытые
// задания — его личные цели (assignedBy = null), выполненные — история.
// Сохранил → нашёл: путь целиком через HTTP настоящего AppModule.
//
// Гоняется дважды: на фейковой Prisma (джоба backend) и на живом Postgres
// (E2E_REAL_DB=1, джоба migrations): интерактивная транзакция, частичный
// unique «одна активная связь на пару» и повторное подключение при строке
// `ended` той же пары — то, где фейк уже расходился с базой.
//
// Действующие лица: терапевт T («Анна»), клиент C (его убирает терапевт),
// клиент K (отключается сам).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

const [T, C, K] = [1n, 2n, 3n].map((n) => 4_700_000_000_000n + n);
const ALL = [T, C, K];
jest.setTimeout(60_000);

type Task = { id: number; text: string; type: string; assignedBy: unknown };

describe('e2e: связь с терапевтом заканчивается — клиент видит это, задания становятся его целями', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const act = (userId: bigint) => {
    const token = signAccessToken(userId, process.env.JWT_SECRET as string);
    const send = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const http = () => request(app.getHttpServer());
    return {
      get: (u: string) => send(http().get(u)),
      post: (u: string, b: object = {}) => send(http().post(u)).send(b),
      del: (u: string) => send(http().delete(u)),
    };
  };
  const connect = async (client: bigint) => {
    const inv = await act(T).post('/api/therapy/invite');
    const join = await act(client).post('/api/therapy/join', {
      code: inv.body.code,
    });
    expect(join.body).toEqual({ ok: true });
  };
  const assign = async (client: bigint, text: string) => {
    const r = await act(T).post('/api/therapy/tasks', {
      type: 'custom',
      text,
      clientId: String(client),
    });
    expect(r.status).toBeLessThan(300);
    return r.body as Task;
  };
  // null сервер отдаёт пустым телом — тогда body = {}.
  const formerOf = async (who: bigint) => {
    const r = await act(who).get('/api/therapy/former-therapist');
    expect(r.status).toBe(200);
    return r.body?.name === undefined ? null : r.body;
  };
  const partnerOf = async (who: bigint) =>
    (await act(who).get('/api/therapy/relation')).body.partnerId ?? null;
  // Задания клиента глазами клиента: текст → assignedBy (метка «От терапевта»).
  const tasksOf = async (who: bigint, path = '/api/therapy/tasks') => {
    const r = await act(who).get(path);
    expect(r.status).toBe(200);
    return Object.fromEntries(
      (r.body as Task[]).map((t) => [t.text, t.assignedBy]),
    );
  };
  const clientIds = async (): Promise<string[]> =>
    (await act(T).get('/api/therapy/clients')).body.map((c: any) =>
      String(c.telegramId),
    );
  // Всё, что терапевт открывает по клиенту, — без живой связи 403.
  const THERAPIST_ROUTES = [
    'client-data',
    'notes',
    'mode-maps',
    'conceptualization',
    'tasks/client',
  ];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await prisma.user.create({
      data: { id: T, role: 'THERAPIST', firstName: 'Анна' },
    });
    for (const id of [C, K])
      await prisma.user.create({ data: { id, role: 'CLIENT' } });
    await connect(C);
    await connect(K);
    await assign(C, 'дневник схем три дня');
    const done = await assign(C, 'выполненное');
    const closed = await act(C).post(`/api/therapy/tasks/${done.id}/complete`, {
      done: true,
    });
    expect(closed.status).toBeLessThan(300);
    expect(
      (await act(T).post(`/api/therapy/request-ysq/${String(C)}`)).status,
    ).toBeLessThan(300);
    await assign(K, 'письмо Уязвимому Ребёнку');
    expect(
      (await act(C).post('/api/therapy/tasks', { type: 'custom', text: 'моё' }))
        .status,
    ).toBeLessThan(300);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  describe('1. терапевт убирает клиента (DELETE /api/therapy/clients/:id)', () => {
    beforeAll(async () => {
      expect(await formerOf(C)).toBeNull();
      expect(await tasksOf(C)).toEqual({
        'дневник схем три дня': Number(T),
        'Пройти тест на схемы': Number(T),
        моё: null,
      });
      const res = await act(T).del(`/api/therapy/clients/${String(C)}`);
      expect([res.status, res.body]).toEqual([200, { ok: true }]);
    });

    it('клиент видит строку о бывшем терапевте с причиной «терапевт убрал»', async () => {
      expect(await partnerOf(C)).toBeNull();
      const former = await formerOf(C);
      expect(former).toEqual({
        name: 'Анна',
        endedAt: expect.any(String),
        reason: 'therapist_removed',
      });
      expect(Number.isNaN(Date.parse(former.endedAt))).toBe(false);
    });

    it('открытые задания и запрос теста — без метки «От терапевта»; выполненное — история с меткой', async () => {
      expect(await tasksOf(C)).toEqual({
        'дневник схем три дня': null,
        'Пройти тест на схемы': null,
        моё: null,
      });
      expect(await tasksOf(C, '/api/therapy/tasks/history')).toEqual({
        выполненное: Number(T),
      });
    });

    it.each(THERAPIST_ROUTES)(
      'терапевт больше не видит клиента: /api/therapy/%s/:id → 403',
      async (route) => {
        const r = await act(T).get(`/api/therapy/${route}/${String(C)}`);
        expect(r.status).toBe(403);
      },
    );

    it('клиента нет в списке, задание ему не назначить, на доске его нет', async () => {
      expect(await clientIds()).not.toContain(String(C));
      const r = await act(T).post('/api/therapy/tasks', {
        type: 'custom',
        text: 'после удаления',
        clientId: String(C),
      });
      expect(r.status).toBe(403);
      const board = await act(T).get('/api/therapy/tasks/all');
      expect(board.body.map((g: any) => String(g.clientId))).not.toContain(
        String(C),
      );
    });

    it('повторное подключение по новому коду: связь живая, строки о бывшем нет, открытые задания терапевту не возвращаются', async () => {
      await connect(C);
      expect(await partnerOf(C)).toBe(Number(T));
      expect(await formerOf(C)).toBeNull();
      expect(await clientIds()).toContain(String(C));
      // Выполненное — общая история, оно видно снова; открытые стали целями C.
      expect(
        await tasksOf(T, `/api/therapy/tasks/client/${String(C)}`),
      ).toEqual({ выполненное: Number(T) });
      // Завершённая строка осталась историей рядом с новой живой.
      const rows = await prisma.therapyRelation.findMany({
        where: { therapistId: T, clientId: C },
      });
      expect(rows.map((x: any) => x.status).sort()).toEqual([
        'active',
        'ended',
      ]);
    });
  });

  describe('2. клиент отключается сам (DELETE /api/therapy/relation)', () => {
    beforeAll(async () => {
      expect(await tasksOf(K)).toEqual({
        'письмо Уязвимому Ребёнку': Number(T),
      });
      const res = await act(K).del('/api/therapy/relation');
      expect([res.status, res.body]).toEqual([200, { ok: true }]);
    });

    it('клиент видит нейтральную строку с причиной «отключился сам»', async () => {
      expect(await partnerOf(K)).toBeNull();
      expect(await formerOf(K)).toEqual({
        name: 'Анна',
        endedAt: expect.any(String),
        reason: 'client_left',
      });
    });

    it('открытое задание терапевта — личная цель клиента', async () => {
      expect(await tasksOf(K)).toEqual({ 'письмо Уязвимому Ребёнку': null });
    });

    it.each(THERAPIST_ROUTES)(
      'терапевт больше не видит клиента: /api/therapy/%s/:id → 403',
      async (route) => {
        const r = await act(T).get(`/api/therapy/${route}/${String(K)}`);
        expect(r.status).toBe(403);
      },
    );

    it('повторное подключение по новому коду работает', async () => {
      expect(await clientIds()).not.toContain(String(K));
      await connect(K);
      expect(await partnerOf(K)).toBe(Number(T));
      expect(await formerOf(K)).toBeNull();
      expect(await clientIds()).toContain(String(K));
    });
  });
});
