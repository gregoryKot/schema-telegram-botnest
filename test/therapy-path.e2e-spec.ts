// e2e-смок ownership пути клиента (#1522): терапевт ведёт путь своего клиента;
// чужой терапевт и сам клиент пути не читают и не пишут, фаза чужого пути по
// id — 404, пункт плана встаёт только в фазу пути своей пары.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e smoke: путь клиента — ownership', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const T1 = 4_000_000_000_000_071n;
  const T2 = 4_000_000_000_000_072n;
  const C1 = 4_000_000_000_000_073n;
  const C2 = 4_000_000_000_000_074n; // клиент T2, для T1 — чужой
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

  const body = {
    startDate: '2026-11-02',
    templateId: 'general',
    phases: [
      {
        name: 'Оценка',
        goal: 'собрать картину',
        weeks: 4,
        templatePhaseId: 'assessment',
      },
      { name: 'Изменения', goal: null, weeks: 24, templatePhaseId: null },
    ],
  };
  type Phase = { id: number; name: string };
  let phaseIds: number[];
  let foreignPhaseId: number;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    for (const id of [T1, T2])
      await prisma.user.create({ data: { id, role: 'THERAPIST' } });
    for (const id of [C1, C2])
      await prisma.user.create({ data: { id, role: 'CLIENT' } });
    await connect(T1, C1);
    await connect(T2, C2);

    const created = await agentAs(T1).post(`/api/therapy/path/${C1}`, body);
    expect(created.status).toBe(201);
    phaseIds = created.body.path.phases.map((p: Phase) => p.id);
    const foreign = await agentAs(T2).post(`/api/therapy/path/${C2}`, body);
    foreignPhaseId = foreign.body.path.phases[0].id as number;
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await app.close();
  });

  it('сохранил → нашёл: путь с фазами открытым текстом, в базе текст зашифрован; повтор — 409', async () => {
    const res = await agentAs(T1).get(`/api/therapy/path/${C1}`);
    expect(res.status).toBe(200);
    expect(res.body.path).toMatchObject({
      clientId: String(C1),
      startDate: body.startDate,
      templateId: 'general',
      phases: [
        {
          ...body.phases[0],
          id: phaseIds[0],
          position: 0,
          startedAt: null,
          endedAt: null,
          criteriaDone: [],
          note: null,
        },
        { ...body.phases[1], id: phaseIds[1], position: 1 },
      ],
    });
    const row = await prisma.therapyPathPhase.findFirst({
      where: { id: phaseIds[0] },
    });
    expect(row?.name).not.toBe('Оценка');
    expect(row?.goal).not.toBe('собрать картину');

    expect(
      (await agentAs(T1).post(`/api/therapy/path/${C1}`, body)).status,
    ).toBe(409);
  });

  it('чужой терапевт не читает и не пишет путь, фаза по id для него — 404', async () => {
    const t2 = agentAs(T2);
    const id = phaseIds[0];
    const denied = [
      await t2.get(`/api/therapy/path/${C1}`),
      await t2.post(`/api/therapy/path/${C1}`, body),
      await t2.patch(`/api/therapy/path/${C1}`, { startDate: '2027-01-01' }),
      await t2.delete(`/api/therapy/path/${C1}`),
      await t2.post(`/api/therapy/path/${C1}/phases`, {
        name: 'Чужая',
        weeks: 1,
      }),
      await t2.post(`/api/therapy/path/${C1}/phases/order`, { ids: phaseIds }),
    ];
    expect(denied.map((r) => r.status)).toEqual(denied.map(() => 403));
    const hidden = [
      await t2.patch(`/api/therapy/path/phases/${id}`, { name: 'взлом' }),
      await t2.post(`/api/therapy/path/phases/${id}/advance`, {
        date: '2026-12-01',
      }),
      await t2.delete(`/api/therapy/path/phases/${id}`),
    ];
    expect(hidden.map((r) => r.status)).toEqual(hidden.map(() => 404));

    const mine = await agentAs(T1).get(`/api/therapy/path/${C1}`);
    expect(mine.body.path.startDate).toBe(body.startDate);
    expect(mine.body.path.phases[0]).toMatchObject({
      name: 'Оценка',
      endedAt: null,
    });
  });

  it('клиент и терапевт без пути: клиенту — 403, пути нет — { path: null }', async () => {
    const c1 = agentAs(C1);
    expect((await c1.get(`/api/therapy/path/${C1}`)).status).toBe(403);
    expect((await c1.post(`/api/therapy/path/${C1}`, body)).status).toBe(403);
    await agentAs(T2).delete(`/api/therapy/path/${C2}`);
    const empty = await agentAs(T2).get(`/api/therapy/path/${C2}`);
    expect(empty.body).toEqual({ path: null });
    const again = await agentAs(T2).post(`/api/therapy/path/${C2}`, body);
    foreignPhaseId = again.body.path.phases[0].id as number;
  });

  it('тело вне DTO — 400', async () => {
    const t1 = agentAs(T1);
    const phase = body.phases[0];
    const bad = [
      { ...body, startDate: '2026-02-31' },
      { ...body, phases: Array.from({ length: 21 }, () => phase) },
      { ...body, phases: [{ ...phase, weeks: 261 }] },
      { ...body, phases: [{ ...phase, name: '   ' }] },
    ];
    for (const b of bad)
      expect((await t1.post(`/api/therapy/path/${C2}`, b)).status).toBe(400);
    const url = `/api/therapy/path/phases/${phaseIds[0]}`;
    const badPatch = [{}, { criteriaDone: [1, 1] }, { note: 'я'.repeat(4001) }];
    for (const b of badPatch) expect((await t1.patch(url, b)).status).toBe(400);
    const order = await t1.post(`/api/therapy/path/${C1}/phases/order`, {
      ids: [phaseIds[0]],
    });
    expect(order.status).toBe(400);
  });

  it('владелец: правка фазы, новая фаза, порядок, переход, старт пути', async () => {
    const t1 = agentAs(T1);
    const [a, b] = phaseIds;
    const patch = await t1.patch(`/api/therapy/path/phases/${a}`, {
      note: 'идёт медленно',
      criteriaDone: [0, 2],
      startedAt: '2026-11-03',
    });
    expect(patch.status).toBe(200);
    expect(patch.body.path.phases[0]).toMatchObject({
      name: 'Оценка',
      note: 'идёт медленно',
      criteriaDone: [0, 2],
      startedAt: '2026-11-03',
    });

    const added = await t1.post(`/api/therapy/path/${C1}/phases`, {
      name: 'Завершение',
      weeks: 8,
    });
    expect(added.status).toBe(201);
    const c = added.body.path.phases[2].id as number;
    const order = await t1.post(`/api/therapy/path/${C1}/phases/order`, {
      ids: [a, c, b],
    });
    expect(order.status).toBe(200);
    expect(order.body.path.phases.map((p: Phase) => p.id)).toEqual([a, c, b]);

    const advanced = await t1.post(`/api/therapy/path/phases/${a}/advance`, {
      date: '2026-12-01',
    });
    expect(advanced.status).toBe(200);
    expect(
      advanced.body.path.phases.map(
        (p: { startedAt: string; endedAt: string }) => [p.startedAt, p.endedAt],
      ),
    ).toEqual([
      ['2026-11-03', '2026-12-01'],
      ['2026-12-01', null],
      [null, null],
    ]);

    const start = await t1.patch(`/api/therapy/path/${C1}`, {
      startDate: '2026-11-09',
    });
    expect(start.body.path.startDate).toBe('2026-11-09');
  });

  it('пункт плана — только в фазу пути своей пары; удаление фазы и пути', async () => {
    const t1 = agentAs(T1);
    const created = await t1.post('/api/therapy/plan', {
      rubric: 'cognitive',
      text: 'проверка убеждений',
      clientIds: [String(C1)],
    });
    const itemUrl = `/api/therapy/plan/items/${created.body.items[0].id}`;
    expect(created.body.items[0].phaseId).toBeNull();
    expect((await t1.patch(itemUrl, { phaseId: foreignPhaseId })).status).toBe(
      404,
    );
    const linked = await t1.patch(itemUrl, { phaseId: phaseIds[1] });
    expect(linked.body.phaseId).toBe(phaseIds[1]);
    const list = await t1.get(`/api/therapy/plan/${C1}`);
    expect(list.body[0].phaseId).toBe(phaseIds[1]);

    const del = await t1.delete(`/api/therapy/path/phases/${phaseIds[1]}`);
    expect(del.body.path.phases.map((p: Phase) => p.id)).not.toContain(
      phaseIds[1],
    );
    const gone = await t1.delete(`/api/therapy/path/${C1}`);
    expect(gone.body).toEqual({ path: null });
    expect((await t1.get(`/api/therapy/path/${C1}`)).body).toEqual({
      path: null,
    });
    expect(await prisma.therapyPath.count({ where: { therapistId: T1 } })).toBe(
      0,
    );
  });
});
