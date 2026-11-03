// e2e: удаление задания терапевтом (DELETE /api/therapy/tasks/:id) и отметка
// задания офлайн-клиента (POST /api/therapy/tasks/:id/complete от терапевта).
// QA-проход 2026-10-26: удалить задание было нельзя ни в интерфейсе, ни в
// API, а задание офлайн-клиента закрыть было некому. Ownership — правило
// «новый эндпоинт = e2e-смок»: чужой терапевт, клиент и задание, которое
// терапевт не назначал, — 403, задание на месте. Реальный AppModule
// (build-test-app.ts); на живом Postgres — джоба migrations.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e: задание терапевта — удаление и отметка у офлайн-клиента', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const secret = () => process.env.JWT_SECRET as string;

  // T1 — терапевт C1, T2 — терапевт без связи с C1, C1 — клиент.
  const T1 = 4_000_000_000_000_301n;
  const T2 = 4_000_000_000_000_302n;
  const C1 = 4_000_000_000_000_303n;
  const C1_ID = String(C1);
  const virtualIds: bigint[] = [];

  function agentAs(userId: bigint) {
    const token = signAccessToken(userId, secret());
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const srv = () => request(app.getHttpServer());
    return {
      get: (url: string) => auth(srv().get(url)),
      post: (url: string, body: object = {}) =>
        auth(srv().post(url)).send(body),
      delete: (url: string) => auth(srv().delete(url)),
    };
  }

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, [T1, T2, C1]);
    // Роль THERAPIST выдаёт только админ-апрув заявки — проставляем напрямую.
    await prisma.user.create({ data: { id: T1, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: T2, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: C1, role: 'CLIENT' } });
    const invite = await agentAs(T1).post('/api/therapy/invite');
    const join = await agentAs(C1).post('/api/therapy/join', {
      code: invite.body.code,
    });
    expect(join.body).toEqual({ ok: true });
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, [T1, T2, C1, ...virtualIds]);
    await app.close();
  });

  async function assign(clientId: string, text: string): Promise<number> {
    const res = await agentAs(T1).post('/api/therapy/tasks', {
      type: 'custom',
      text,
      clientId,
    });
    expect(res.status).toBeLessThan(300);
    return res.body.id as number;
  }

  const clientTaskTexts = async () =>
    (await agentAs(T1).get(`/api/therapy/tasks/client/${C1_ID}`)).body.map(
      (t: { text: string }) => t.text,
    );

  it('чужой терапевт и сам клиент удалить задание не могут — 403, задание на месте', async () => {
    const id = await assign(C1_ID, 'задание для чужих');
    expect((await agentAs(T2).delete(`/api/therapy/tasks/${id}`)).status).toBe(
      403,
    );
    expect((await agentAs(C1).delete(`/api/therapy/tasks/${id}`)).status).toBe(
      403,
    );
    expect(await clientTaskTexts()).toContain('задание для чужих');
  });

  it('свою цель клиента терапевт не удаляет', async () => {
    const own = await agentAs(C1).post('/api/therapy/tasks', {
      type: 'custom',
      text: 'моя цель',
    });
    expect(
      (await agentAs(T1).delete(`/api/therapy/tasks/${own.body.id}`)).status,
    ).toBe(403);
    const mine = await agentAs(C1).get('/api/therapy/tasks');
    expect(mine.body.map((t: { text: string }) => t.text)).toContain(
      'моя цель',
    );
  });

  it('назначивший терапевт удаляет — задание пропадает и у него, и у клиента', async () => {
    const id = await assign(C1_ID, 'удалить меня');
    const res = await agentAs(T1).delete(`/api/therapy/tasks/${id}`);
    expect([res.status, res.body]).toEqual([200, { ok: true }]);
    expect(await clientTaskTexts()).not.toContain('удалить меня');
    const mine = await agentAs(C1).get('/api/therapy/tasks');
    expect(mine.body.map((t: { text: string }) => t.text)).not.toContain(
      'удалить меня',
    );
  });

  it('задание офлайн-клиента закрывает только назначивший терапевт', async () => {
    const created = await agentAs(T1).post('/api/therapy/clients/virtual', {
      name: 'Офлайн E2E',
    });
    const vid = String(
      created.body.find((c: { name: string }) => c.name === 'Офлайн E2E')
        .telegramId,
    );
    virtualIds.push(BigInt(vid));
    const id = await assign(vid, 'прочитать главу');

    for (const who of [T2, C1])
      expect(
        (
          await agentAs(who).post(`/api/therapy/tasks/${id}/complete`, {
            done: true,
          })
        ).status,
      ).toBe(403);
    const done = await agentAs(T1).post(`/api/therapy/tasks/${id}/complete`, {
      done: true,
    });
    expect(done.status).toBeLessThan(300);
    const list = await agentAs(T1).get(`/api/therapy/tasks/client/${vid}`);
    expect(list.body.find((t: { id: number }) => t.id === id).done).toBe(true);
  });

  it('задание клиента с аккаунтом терапевт за клиента не закрывает', async () => {
    const id = await assign(C1_ID, 'сделает сам');
    const res = await agentAs(T1).post(`/api/therapy/tasks/${id}/complete`, {
      done: true,
    });
    expect(res.status).toBe(403);
  });
});
