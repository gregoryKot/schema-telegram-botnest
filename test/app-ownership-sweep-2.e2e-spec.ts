// e2e SMOKE — продолжение app-ownership-sweep.e2e-spec.ts (TEST_IMPROVEMENT_
// PLAN.md, этап 1.3): маршруты, которые остались непокрытыми у трипваера
// e2e-route-coverage.invariants.spec.ts. Этот файл — «мутации/удаления»:
// diary DELETE, practices DELETE, plan checkin+history, ysq-progress/result
// DELETE, пары (invite/join/leave). Паттерн для delete-style роутов такой же,
// как у terapy-ownership («B не может создать/удалить чужое» — сервисы фильтруют
// по userId в WHERE, поэтому чужой DELETE — молчаливый no-op, не 403; тест
// проверяет, что строка реально осталась у владельца, а не только код ответа).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e smoke: ownership sweep 2 (deletes/mutations: diary, plans, ysq, pairs)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const secret = () => process.env.JWT_SECRET as string;
  const USER_A = 5_000_000_000_000_001n;
  const USER_B = 5_000_000_000_000_002n;
  const USER_C = 5_000_000_000_000_003n;
  const ALL_USER_IDS = [USER_A, USER_B, USER_C];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    // Изоляция между прогонами (TEST_TRUST_PLAN.md, п.1) — см. комментарий
    // в app-ownership.e2e-spec.ts. Обязательна на реальном Postgres, no-op
    // на фейке.
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await app.close();
  });

  function agentAs(userId: bigint) {
    const token = signAccessToken(userId, secret());
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(request(app.getHttpServer()).get(url)),
      post: (url: string, body: object = {}) =>
        auth(request(app.getHttpServer()).post(url)).send(body),
      delete: (url: string, body: object = {}) =>
        auth(request(app.getHttpServer()).delete(url)).send(body),
    };
  }

  // ─── Delete-with-id: create as A → list has it → B deletes (no-op) → still
  // there → A deletes → gone. Same shape for diary entries and a practice.
  // `del` issues the DELETE request itself (template literal directly next
  // to `.delete(`, same shape as `create`'s `.post(`) — not a URL-building
  // helper called indirectly. e2e-route-coverage.invariants.spec.ts scans for
  // literal `.delete('...')`/`.post('...')` call sites; a helper that returns
  // a string and gets passed to `.delete(url)` elsewhere would be invisible
  // to that (deliberately simple, no-AST) scan.
  const DELETE_ENDPOINTS: Array<{
    label: string;
    create: (a: ReturnType<typeof agentAs>) => Promise<request.Response>;
    list: string;
    del: (
      a: ReturnType<typeof agentAs>,
      id: number,
    ) => Promise<request.Response>;
  }> = [
    {
      label: 'diary/schema',
      create: (a) =>
        a.post('/api/diary/schema', {
          trigger: 't',
          emotions: [],
          schemaIds: [],
        }),
      list: '/api/diary/schema',
      del: (a, id) => a.delete(`/api/diary/schema/${id}`),
    },
    {
      label: 'diary/mode',
      create: (a) =>
        a.post('/api/diary/mode', {
          modeId: 'vulnerable_child',
          situation: 's',
        }),
      list: '/api/diary/mode',
      del: (a, id) => a.delete(`/api/diary/mode/${id}`),
    },
    {
      label: 'diary/gratitude',
      create: (a) =>
        a.post('/api/diary/gratitude', { date: '2099-02-02', items: ['x'] }),
      list: '/api/diary/gratitude',
      del: (a, id) => a.delete(`/api/diary/gratitude/${id}`),
    },
    {
      label: 'practices',
      create: (a) =>
        a.post('/api/practices', { needId: 'attachment', text: 'walk' }),
      list: '/api/practices?needId=attachment',
      del: (a, id) => a.delete(`/api/practices/${id}`),
    },
  ];

  it.each(DELETE_ENDPOINTS)(
    '$label: B не может удалить чужую запись, A может удалить свою',
    async ({ create, list, del }) => {
      const a = agentAs(USER_A);
      const b = agentAs(USER_B);

      const created = await create(a);
      expect(created.status).toBeLessThan(300);
      const id = created.body.id as number;

      const bDelete = await del(b, id);
      expect(bDelete.status).toBeLessThan(300); // filtered WHERE — no-op, not 403
      const stillThere = await a.get(list);
      expect(stillThere.body.some((r: { id: number }) => r.id === id)).toBe(
        true,
      );

      const aDelete = await del(a, id);
      expect(aDelete.status).toBeLessThan(300);
      const gone = await a.get(list);
      expect(gone.body.some((r: { id: number }) => r.id === id)).toBe(false);
    },
  );

  // ─── Plan checkin + history ────────────────────────────────────────────────

  it('plan checkin: B не может отметить чужой план, история видна только владельцу', async () => {
    const a = agentAs(USER_A);
    const b = agentAs(USER_B);

    const created = await a.post('/api/plan', {
      needId: 'attachment',
      practiceText: 'вечерняя прогулка',
    });
    expect(created.status).toBeLessThan(300);
    const planId = created.body.id as number;

    const bCheckin = await b.post(`/api/plan/${planId}/checkin`, {
      done: true,
    });
    expect(bCheckin.status).toBeLessThan(300); // updateMany WHERE userId — no-op

    const bHistory = await b.get('/api/plans/history?days=30');
    expect(bHistory.status).toBe(200);
    expect(
      bHistory.body.find((p: { id: number }) => p.id === planId),
    ).toBeUndefined();

    const aCheckin = await a.post(`/api/plan/${planId}/checkin`, {
      done: true,
    });
    expect(aCheckin.status).toBeLessThan(300);

    const aHistory = await a.get('/api/plans/history?days=30');
    expect(aHistory.status).toBe(200);
    const row = aHistory.body.find((p: { id: number }) => p.id === planId);
    expect(row?.done).toBe(true); // B's no-op checkin never touched it
  });

  // ─── YSQ progress/result DELETE (self-only — no id param, always caller) ──

  it('ysq-progress DELETE: чистит свой прогресс, не трогает чужой', async () => {
    const a = agentAs(USER_A);
    const b = agentAs(USER_B);
    await a.post('/api/ysq-progress', { answers: Array(116).fill(1), page: 2 });
    await b.post('/api/ysq-progress', { answers: Array(116).fill(3), page: 5 });

    const del = await a.delete('/api/ysq-progress');
    expect(del.status).toBeLessThan(300);

    const aGet = await a.get('/api/ysq-progress');
    expect(aGet.text).toBe('');
    const bGet = await b.get('/api/ysq-progress');
    expect(bGet.body.page).toBe(5);
  });

  it('ysq-result DELETE: чистит свой результат, не трогает чужой', async () => {
    const a = agentAs(USER_A);
    const b = agentAs(USER_B);
    await a.post('/api/ysq-result', { answers: Array(116).fill(2) });
    await b.post('/api/ysq-result', { answers: Array(116).fill(4) });

    const del = await a.delete('/api/ysq-result');
    expect(del.status).toBeLessThan(300);

    const aGet = await a.get('/api/ysq-result');
    expect(aGet.text).toBe('');
    const bGet = await b.get('/api/ysq-result');
    expect(bGet.body.answers).toHaveLength(116);
  });

  // ─── Pairs: invite → join → visible to both, not to a third user; leave ───

  it('pairs: invite+join виден обоим партнёрам, посторонний C ничего не видит', async () => {
    const a = agentAs(USER_A);
    const b = agentAs(USER_B);
    const c = agentAs(USER_C);

    const invite = await a.post('/api/pair/invite');
    expect(invite.status).toBeLessThan(300);
    const code = invite.body.code as string;

    const join = await b.post('/api/pair/join', { code });
    expect(join.status).toBeLessThan(300);
    expect(join.body).toEqual({ ok: true });

    const aPair = await a.get('/api/pair');
    expect(aPair.status).toBe(200);
    expect(aPair.body.partners).toHaveLength(1);
    expect(aPair.body.partners[0].partnerTelegramId).toBe(Number(USER_B));

    const cPair = await c.get('/api/pair');
    expect(cPair.status).toBe(200);
    expect(cPair.body.partners).toHaveLength(0);

    const leave = await a.delete('/api/pair', { code });
    expect(leave.status).toBeLessThan(300);

    const aPairAfter = await a.get('/api/pair');
    expect(aPairAfter.body.partners).toHaveLength(0);
  });
});
