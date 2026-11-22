// e2e-смок ownership плана работы (issue 1337, часть 1): терапевт ведёт план
// своего клиента; чужой терапевт и сам клиент плана не читают и не пишут,
// чужому клиенту пункт не добавить, отвязка клиента стирает его пункты.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e smoke: план работы с клиентом — ownership', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const T1 = 4_000_000_000_000_061n;
  const T2 = 4_000_000_000_000_062n;
  const C1 = 4_000_000_000_000_063n;
  const C2 = 4_000_000_000_000_064n; // клиент T2, для T1 — чужой
  const ALL_USER_IDS = [T1, T2, C1, C2];

  function agentAs(userId: bigint) {
    const token = signAccessToken(userId, process.env.JWT_SECRET as string);
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const http = () => request(app.getHttpServer());
    return {
      get: (url: string) => auth(http().get(url)),
      post: (url: string, body: object = {}) =>
        auth(http().post(url)).send(body),
      patch: (url: string, body: object = {}) =>
        auth(http().patch(url)).send(body),
      delete: (url: string) => auth(http().delete(url)),
    };
  }

  async function connect(therapist: bigint, client: bigint) {
    const invite = await agentAs(therapist).post('/api/therapy/invite');
    expect(invite.status).toBeLessThan(300);
    const join = await agentAs(client).post('/api/therapy/join', {
      code: invite.body.code,
    });
    expect(join.body).toEqual({ ok: true });
  }

  const item = { rubric: 'cognitive', text: 'проверка убеждений' };
  let itemId: number;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    for (const id of [T1, T2])
      await prisma.user.create({ data: { id, role: 'THERAPIST' } });
    for (const id of [C1, C2])
      await prisma.user.create({ data: { id, role: 'CLIENT' } });
    await connect(T1, C1);
    await connect(T2, C2);

    const created = await agentAs(T1).post('/api/therapy/plan', {
      ...item,
      clientIds: [String(C1)],
      sourceAddress: 'schema:abandonment/cognitive',
    });
    expect(created.status).toBe(201);
    itemId = created.body.items[0].id as number;
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await app.close();
  });

  it('терапевт видит свой пункт открытым текстом, в базе текст зашифрован', async () => {
    const res = await agentAs(T1).get(`/api/therapy/plan/${C1}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        ...item,
        id: itemId,
        clientId: String(C1),
        status: 'planned',
        position: 0,
        sourceAddress: 'schema:abandonment/cognitive',
        source: null,
        taskId: null,
      }),
    ]);
    const row = await prisma.therapyPlanItem.findFirst({
      where: { id: itemId },
    });
    expect(row?.text).not.toBe(item.text);
  });

  it('чужой терапевт не читает план и не трогает пункт по id', async () => {
    const t2 = agentAs(T2);
    expect((await t2.get(`/api/therapy/plan/${C1}`)).status).toBe(403);
    const patch = await t2.patch(`/api/therapy/plan/items/${itemId}`, {
      status: 'done',
    });
    expect(patch.status).toBe(404);
    expect((await t2.delete(`/api/therapy/plan/items/${itemId}`)).status).toBe(
      404,
    );
    const order = await t2.post(`/api/therapy/plan/order/${C1}`, {
      ids: [itemId],
    });
    expect(order.status).toBe(403);
    const mine = await agentAs(T1).get(`/api/therapy/plan/${C1}`);
    expect(mine.body[0].status).toBe('planned');
  });

  it('чужому клиенту пункт не добавить — даже вместе со своим', async () => {
    const res = await agentAs(T1).post('/api/therapy/plan', {
      ...item,
      clientIds: [String(C1), String(C2)],
    });
    expect(res.status).toBe(403);
    expect(
      await prisma.therapyPlanItem.count({ where: { clientId: C2 } }),
    ).toBe(0);
    const mine = await agentAs(T1).get(`/api/therapy/plan/${C1}`);
    expect(mine.body).toHaveLength(1);
  });

  it('клиент плана не видит и не пишет', async () => {
    const c1 = agentAs(C1);
    expect((await c1.get(`/api/therapy/plan/${C1}`)).status).toBe(403);
    const res = await c1.post('/api/therapy/plan', {
      ...item,
      clientIds: [String(C1)],
    });
    expect(res.status).toBe(403);
  });

  it('тело вне DTO — 400', async () => {
    const t1 = agentAs(T1);
    const bad = [
      { ...item, clientIds: [] },
      { ...item, rubric: 'unknown', clientIds: [String(C1)] },
      { ...item, text: '   ', clientIds: [String(C1)] },
    ];
    for (const body of bad)
      expect((await t1.post('/api/therapy/plan', body)).status).toBe(400);
    const empty = await t1.patch(`/api/therapy/plan/items/${itemId}`, {});
    expect(empty.status).toBe(400);
  });

  it('правка, порядок и удаление у владельца; отвязка клиента стирает пункты', async () => {
    const t1 = agentAs(T1);
    const patch = await t1.patch(`/api/therapy/plan/items/${itemId}`, {
      status: 'active',
      text: 'новый текст',
    });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ status: 'active', text: 'новый текст' });

    const second = await t1.post('/api/therapy/plan', {
      rubric: 'custom',
      text: 'свой пункт',
      clientIds: [String(C1)],
    });
    const secondId = second.body.items[0].id as number;
    const order = await t1.post(`/api/therapy/plan/order/${C1}`, {
      ids: [secondId, itemId],
    });
    expect(order.body).toEqual({ ok: true });
    const list = await t1.get(`/api/therapy/plan/${C1}`);
    expect(list.body.map((i: { id: number }) => i.id)).toEqual([
      secondId,
      itemId,
    ]);

    const del = await t1.delete(`/api/therapy/plan/items/${secondId}`);
    expect(del.body).toEqual({ ok: true });

    const removed = await t1.delete(`/api/therapy/clients/${C1}`);
    expect(removed.status).toBeLessThan(300);
    expect(
      await prisma.therapyPlanItem.count({ where: { therapistId: T1 } }),
    ).toBe(0);
  });
});
