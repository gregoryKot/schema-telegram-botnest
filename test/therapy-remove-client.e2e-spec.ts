// e2e: удаление клиента терапевтом (DELETE /api/therapy/clients/:clientId,
// removeTherapistClient) на ВСЕХ сценариях — HTTP + проверка базы ДО и ПОСЛЕ.
// Родилось из дыры PR #586: диалог обещал стереть «заметки и концептуализацию»,
// а именные карты режимов (ModeMap) оставались — у клиента с аккаунтом они
// всплывали при повторном подключении, у виртуального становились сиротами.
//
// Гоняется дважды: на фейковой Prisma (джоба backend) и на живом Postgres
// (E2E_REAL_DB=1, джоба migrations): фильтрация по паре (therapistId, clientId),
// IS NULL в where и транзакция — как раз то, где фейк уже расходился с базой.
//
// Действующие лица: терапевты A и B, клиент C с аккаунтом (связан и с A, и с B),
// клиент D (только у B), виртуальные V1/V2 (у A) и V3 (у B).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

const [A, B, C, D, U, E, F] = [1n, 2n, 3n, 4n, 5n, 6n, 7n].map(
  (n) => 4_100_000_000_000n + n,
);
// Сборка мира идёт десятками HTTP-запросов — на живой базе дольше дефолтных 5 с.
jest.setTimeout(60_000);

const ID = (x: bigint) => Number(x);
const FULL = { notes: 1, concept: 1, maps: 1, tasks: 1 };
const EMPTY = { notes: 0, concept: 0, maps: 0, tasks: 0 };

describe('e2e: терапевт удаляет клиента (все сценарии)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const virtualIds: bigint[] = []; // отрицательные clientId — для чистки
  const vid: Record<string, bigint> = {};

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
  const rm = (who: bigint, clientId: bigint | number) =>
    act(who).del(`/api/therapy/clients/${clientId}`);

  // Что терапевт t хранит про клиента cid (cid < 0 — виртуальный).
  const data = async (t: bigint, cid: bigint) => ({
    notes: await prisma.therapistNote.count({
      where: { therapistId: t, clientId: cid },
    }),
    concept: await prisma.clientConceptualization.count({
      where: { therapistId: t, clientId: cid },
    }),
    maps: await prisma.modeMap.count({
      where: { therapistId: t, clientId: cid },
    }),
    tasks: await prisma.userTask.count({
      where: { userId: cid, assignedBy: t },
    }),
  });
  const relCount = (t: bigint, cid: bigint) =>
    cid < 0n
      ? prisma.therapyRelation.count({
          where: { id: Number(-cid), therapistId: t },
        })
      : prisma.therapyRelation.count({
          where: { therapistId: t, clientId: cid },
        });
  const clientIds = async (t: bigint): Promise<number[]> =>
    (await act(t).get('/api/therapy/clients')).body.map(
      (c: any) => c.telegramId,
    );

  async function seed(t: bigint, cid: bigint) {
    const h = act(t);
    const n = ID(cid);
    // Запросы строго по очереди: supertest поднимает сервер при создании
    // запроса и гасит после ответа, параллельные запросы получают ECONNREFUSED.
    const calls = [
      () =>
        h.post(`/api/therapy/notes/${n}`, {
          date: '2026-09-01',
          text: `заметка ${t}/${cid}`,
        }),
      () =>
        h.post(`/api/therapy/conceptualization/${n}`, {
          earlyExperience: `опыт ${t}/${cid}`,
        }),
      () =>
        h.post(`/api/therapy/mode-maps/${n}`, { title: `карта ${t}/${cid}` }),
      () =>
        h.post('/api/therapy/tasks', {
          type: 'custom',
          text: `задание ${t}/${cid}`,
          clientId: n,
        }),
    ];
    for (const call of calls) expect((await call()).status).toBeLessThan(300);
    expect(await data(t, cid)).toEqual(FULL);
  }
  async function connect(t: bigint, client: bigint) {
    const inv = await act(t).post('/api/therapy/invite');
    const join = await act(client).post('/api/therapy/join', {
      code: inv.body.code,
    });
    expect(join.body).toEqual({ ok: true });
  }
  async function addVirtual(t: bigint, name: string) {
    const res = await act(t).post('/api/therapy/clients/virtual', { name });
    const id = BigInt(res.body.find((c: any) => c.name === name).telegramId);
    vid[name] = id;
    virtualIds.push(id);
    return id;
  }

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, [A, B, C, D, U, E, F]);
    for (const [id, role] of [
      [A, 'THERAPIST'],
      [B, 'THERAPIST'],
      [F, 'THERAPIST'],
      [C, 'CLIENT'],
      [D, 'CLIENT'],
      [U, 'CLIENT'],
      [E, 'CLIENT'],
    ] as const)
      await prisma.user.create({ data: { id, role } });

    await connect(A, C);
    await connect(B, C);
    await connect(B, D);
    await addVirtual(A, 'V1');
    await addVirtual(A, 'V2');
    await addVirtual(B, 'V3');
    for (const [t, cid] of [
      [A, C],
      [B, C],
      [B, D],
      [A, vid.V1],
      [A, vid.V2],
      [B, vid.V3],
    ] as const)
      await seed(t, cid);
    // собственные данные клиента C
    await prisma.userSchemaNote.create({
      data: { userId: C, schemaId: 'abandonment' },
    });
    await prisma.rating.create({
      data: { userId: C, date: '2026-09-01', needId: 'safety', value: 7 },
    });
    expect(
      (await act(C).post('/api/therapy/tasks', { type: 'custom', text: 'моё' }))
        .status,
    ).toBeLessThan(300);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, [
      A,
      B,
      C,
      D,
      U,
      E,
      F,
      ...virtualIds,
    ]);
    await app.close();
  });

  const cOwn = async () => ({
    user: await prisma.user.count({ where: { id: C } }),
    schemaNotes: await prisma.userSchemaNote.count({ where: { userId: C } }),
    ratings: await prisma.rating.count({ where: { userId: C } }),
    selfTasks: await prisma.userTask.count({
      where: { userId: C, assignedBy: null },
    }),
    byA: await prisma.userTask.count({ where: { userId: C, assignedBy: A } }),
    byB: await prisma.userTask.count({ where: { userId: C, assignedBy: B } }),
  });
  const C_OWN = {
    user: 1,
    schemaNotes: 1,
    ratings: 1,
    selfTasks: 1,
    byA: 1,
    byB: 1,
  };

  describe('1. A удаляет C (клиент с аккаунтом)', () => {
    beforeAll(async () => {
      expect(await relCount(A, C)).toBe(1);
      expect(await cOwn()).toEqual(C_OWN);
      expect(await clientIds(A)).toContain(ID(C));
      const res = await rm(A, C);
      expect([res.status, res.body]).toEqual([200, { ok: true }]);
    });

    it('у A для C исчезли заметки, концептуализация, карты режимов и связь; задание от A остаётся у клиента', async () => {
      expect(await relCount(A, C)).toBe(0);
      expect(await data(A, C)).toEqual({ ...EMPTY, tasks: 1 });
    });
    it('User и собственные данные C целы (дневник-оценка, заметка схемы, своё задание, задание от A)', async () => {
      expect(await cOwn()).toEqual(C_OWN);
    });
    it('C пропал из списка клиентов A, остальные на месте', async () => {
      const ids = await clientIds(A);
      expect(ids).not.toContain(ID(C));
      expect(ids).toEqual(expect.arrayContaining([ID(vid.V1), ID(vid.V2)]));
    });
    it.each([
      'notes',
      'conceptualization',
      'mode-maps',
      'client-data',
      'tasks/client',
    ])(
      'A больше не читает C через /api/therapy/%s/:id → 403',
      async (route) => {
        expect(
          (await act(A).get(`/api/therapy/${route}/${ID(C)}`)).status,
        ).toBe(403);
      },
    );
    it('у B связь с C, заметки, концептуализация, карты и задания целы; B видит C и его данные', async () => {
      expect(await relCount(B, C)).toBe(1);
      expect(await data(B, C)).toEqual(FULL);
      expect(await clientIds(B)).toContain(ID(C));
      const b = act(B);
      expect((await b.get(`/api/therapy/notes/${ID(C)}`)).body).toHaveLength(1);
      expect(
        (await b.get(`/api/therapy/conceptualization/${ID(C)}`)).body
          .earlyExperience,
      ).toBe(`опыт ${B}/${C}`);
      expect(
        (await b.get(`/api/therapy/mode-maps/${ID(C)}`)).body,
      ).toHaveLength(1);
      expect((await b.get(`/api/therapy/client-data/${ID(C)}`)).status).toBe(
        200,
      );
    });
    it('C в своём кабинете видит только карту B: карта A стёрта, а не просто закрыта', async () => {
      const maps = (await act(C).get('/api/therapy/my-mode-maps')).body;
      expect(maps.map((m: any) => m.title)).toEqual([`карта ${B}/${C}`]);
    });
  });

  describe('2. C подключается к A заново по новому коду', () => {
    beforeAll(() => connect(A, C));

    it('у A для C пусто: ни заметок, ни концептуализации, ни карт', async () => {
      expect(await relCount(A, C)).toBe(1);
      expect(await data(A, C)).toMatchObject({ notes: 0, concept: 0, maps: 0 });
      const a = act(A);
      expect((await a.get(`/api/therapy/notes/${ID(C)}`)).body).toEqual([]);
      expect((await a.get(`/api/therapy/mode-maps/${ID(C)}`)).body).toEqual([]);
      const concept = await a.get(`/api/therapy/conceptualization/${ID(C)}`);
      expect([concept.status, concept.body.earlyExperience]).toEqual([
        200,
        undefined,
      ]);
    });
    // ФИКСАЦИЯ текущего поведения, не цель исправления: задание от A остаётся в
    // аккаунте C (так обещает текст диалога), а tasks/client фильтрует по
    // assignedBy, поэтому старое задание снова видно A после повторного join.
    it('фиксация: старое задание, назначенное A, всплывает у A после повторного подключения', async () => {
      const tasks = await act(A).get(`/api/therapy/tasks/client/${ID(C)}`);
      expect([tasks.status, tasks.body.length]).toEqual([200, 1]);
    });
  });

  describe('3. A удаляет V1 (виртуального)', () => {
    beforeAll(async () => {
      expect(await data(A, vid.V1)).toEqual(FULL);
      expect((await rm(A, vid.V1)).body).toEqual({ ok: true });
    });
    it('исчезли связь, заметки, концептуализация, карты и задания V1', async () => {
      expect(await relCount(A, vid.V1)).toBe(0);
      expect(await data(A, vid.V1)).toEqual(EMPTY);
      expect(await clientIds(A)).not.toContain(ID(vid.V1));
      expect(
        (await act(A).get(`/api/therapy/notes/${ID(vid.V1)}`)).status,
      ).toBe(403);
    });
    it('V2 у A цел целиком, включая задания', async () => {
      expect(await relCount(A, vid.V2)).toBe(1);
      expect(await data(A, vid.V2)).toEqual(FULL);
      expect(
        (await act(A).get(`/api/therapy/notes/${ID(vid.V2)}`)).body,
      ).toHaveLength(1);
      expect(await clientIds(A)).toContain(ID(vid.V2));
    });
    it('V3 у B цел целиком', async () => {
      expect(await relCount(B, vid.V3)).toBe(1);
      expect(await data(B, vid.V3)).toEqual(FULL);
    });
  });

  describe('4. A шлёт DELETE на чужого клиента', () => {
    // Сервер отвечает 200 {ok:true} и ничего не делает: WHERE везде ограничен
    // therapistId вызывающего. Фиксируем именно это — не 403/404.
    it('V3 (виртуальный клиент B) и D (клиент с аккаунтом только у B): 200, у B ничего не тронуто', async () => {
      for (const target of [vid.V3, D]) {
        const res = await rm(A, target);
        expect([res.status, res.body]).toEqual([200, { ok: true }]);
        expect(await relCount(B, target)).toBe(1);
        expect(await data(B, target)).toEqual(FULL);
        expect(await clientIds(B)).toContain(ID(target));
      }
      expect(await data(A, vid.V2)).toEqual(FULL);
    });
    it('отрицательный id связи A с РЕАЛЬНЫМ клиентом C — no-op: связь и данные на месте', async () => {
      // после повторного join у A к C осталось только старое задание — чистим
      // его, чтобы seed дал ровно FULL, а не два задания
      await prisma.userTask.deleteMany({ where: { userId: C, assignedBy: A } });
      await seed(A, C);
      const rel = await prisma.therapyRelation.findFirst({
        where: { therapistId: A, clientId: C },
      });
      expect((await rm(A, -rel!.id)).status).toBe(200);
      expect(await relCount(A, C)).toBe(1);
      expect(await data(A, C)).toEqual(FULL);
    });
  });

  describe('5. Не терапевт', () => {
    it('обычный пользователь и сам клиент получают 403, база не меняется', async () => {
      for (const [who, target] of [
        [U, vid.V2],
        [U, C],
        [C, C],
        [E, D],
      ] as const) {
        expect((await rm(who, target)).status).toBe(403);
      }
      expect(await relCount(A, vid.V2)).toBe(1);
      expect(await data(A, vid.V2)).toEqual(FULL);
      expect(await relCount(A, C)).toBe(1);
      expect(await relCount(B, D)).toBe(1);
      expect(await data(B, D)).toEqual(FULL);
    });
  });

  describe('6. Повторный DELETE', () => {
    it('того же виртуального и того же клиента с аккаунтом: оба раза 200, не 500', async () => {
      await connect(A, E);
      const v4 = await addVirtual(A, 'V4');
      await seed(A, E);
      await seed(A, v4);
      for (const target of [v4, E]) {
        expect((await rm(A, target)).status).toBe(200);
        expect(await data(A, target)).toEqual(
          target < 0n ? EMPTY : { ...EMPTY, tasks: 1 },
        );
        expect((await rm(A, target)).status).toBe(200);
        expect(await relCount(A, target)).toBe(0);
      }
    });
  });

  describe('7. Клиент сам отключается (DELETE /api/therapy/relation от C)', () => {
    // ФИКСАЦИЯ ТЕКУЩЕГО ПОВЕДЕНИЯ, не цель исправления. disconnect() удаляет ВСЕ
    // связи, где пользователь терапевт или клиент (deleteMany OR), поэтому C
    // рвёт сразу и A, и B. Данные терапевта по клиенту при этом остаются.
    beforeAll(async () => {
      expect(await data(A, C)).toEqual(FULL); // досеяно в сценарии 4
      expect(await data(B, C)).toEqual(FULL);
      const res = await act(C).del('/api/therapy/relation');
      expect([res.status, res.body]).toEqual([200, { ok: true }]);
    });

    it('обе связи C (и с A, и с B) удалены', async () => {
      expect(await relCount(A, C)).toBe(0);
      expect(await relCount(B, C)).toBe(0);
      expect(await clientIds(A)).not.toContain(ID(C));
      expect(await clientIds(B)).not.toContain(ID(C));
    });
    it('у терапевтов заметки, концептуализация, карты и задания по C остаются, но недоступны через API', async () => {
      expect(await data(A, C)).toEqual(FULL);
      expect(await data(B, C)).toEqual(FULL);
      for (const t of [A, B])
        for (const route of ['notes', 'mode-maps', 'client-data'])
          expect(
            (await act(t).get(`/api/therapy/${route}/${ID(C)}`)).status,
          ).toBe(403);
    });
    it('у клиента все данные целы, а карты терапевтов он продолжает видеть в my-mode-maps', async () => {
      expect(await cOwn()).toEqual(C_OWN);
      const maps = await act(C).get('/api/therapy/my-mode-maps');
      expect(maps.body).toHaveLength(2);
    });
    it('терапевт, вызвавший тот же DELETE /relation, теряет и виртуального клиента (данные остаются сиротами)', async () => {
      const vf = await addVirtual(F, 'VF');
      await seed(F, vf);
      expect((await act(F).del('/api/therapy/relation')).status).toBe(200);
      expect(await relCount(F, vf)).toBe(0);
      expect(await data(F, vf)).toEqual(FULL);
    });
  });
});
