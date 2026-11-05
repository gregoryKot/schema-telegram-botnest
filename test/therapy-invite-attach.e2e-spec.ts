// e2e: приглашение в приложение существующего офлайн-клиента терапевта
// (POST /api/therapy/clients/:negId/invite → join). Что обещает фича: после
// подключения у терапевта ОДНА карточка, а задания, заметки, карты режимов и
// концептуализация офлайн-карточки (лежат на -TherapyRelation.id, без FK)
// переехали на аккаунт клиента; офлайн-строка и её приглашение исчезли.
// Сценарии: a) обычный проход, b) клиент уже подключён (побеждает новее
// концептуализация), c) удаление карточки отзывает её приглашение.
//
// Гоняется дважды: фейковая Prisma (джоба backend) и живой Postgres
// (E2E_REAL_DB=1, джоба migrations): updateMany по отрицательному userId,
// транзакция переноса и каскад attachToId — ровно то, где фейк мог разойтись.
//
// Действующие лица: терапевты TH («Анна») и TH2, клиенты C («Мария») и D.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

const [TH, TH2, C, D, P] = [1n, 2n, 3n, 4n, 5n].map(
  (n) => 4_400_000_000_000n + n,
);
const ALL = [TH, TH2, C, D, P];
jest.setTimeout(60_000);

describe('e2e: приглашение офлайн-клиента с переносом данных', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const as = (userId: bigint) => {
    const token = signAccessToken(userId, process.env.JWT_SECRET as string);
    const send = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const http = () => request(app.getHttpServer());
    return {
      get: (u: string) => send(http().get(u)),
      post: (u: string, body: object = {}) => send(http().post(u)).send(body),
      delete: (u: string) => send(http().delete(u)),
    };
  };

  // Запросы строго по очереди (supertest гасит сервер после ответа).
  async function addCard(name: string): Promise<bigint> {
    const res = await as(TH).post('/api/therapy/clients/virtual', { name });
    expect(res.status).toBe(201);
    return BigInt(res.body.find((c: any) => c.name === name).telegramId);
  }
  async function seedCard(neg: bigint, marker: string) {
    const n = Number(neg);
    const h = as(TH);
    const calls = [
      () =>
        h.post(`/api/therapy/notes/${n}`, {
          date: '2026-09-01',
          text: `заметка ${marker}`,
        }),
      () =>
        h.post(`/api/therapy/conceptualization/${n}`, {
          earlyExperience: marker,
        }),
      () => h.post(`/api/therapy/mode-maps/${n}`, { title: `карта ${marker}` }),
      () =>
        h.post('/api/therapy/tasks', {
          type: 'custom',
          text: `задание ${marker}`,
          clientId: n,
        }),
    ];
    for (const call of calls) expect((await call()).status).toBeLessThan(300);
  }
  const rowsOn = async (cid: bigint) => ({
    notes: await prisma.therapistNote.count({
      where: { therapistId: TH, clientId: cid },
    }),
    concept: await prisma.clientConceptualization.count({
      where: { therapistId: TH, clientId: cid },
    }),
    maps: await prisma.modeMap.count({
      where: { therapistId: TH, clientId: cid },
    }),
    tasks: await prisma.userTask.count({
      where: { userId: cid, assignedBy: TH },
    }),
  });

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await prisma.user.create({
      data: { id: TH, role: 'THERAPIST', firstName: 'Анна' },
    });
    await prisma.user.create({ data: { id: TH2, role: 'THERAPIST' } });
    for (const [id, firstName] of [
      [C, 'Мария'],
      [D, 'Дмитрий'],
      [P, 'Пётр'],
    ] as const)
      await prisma.user.create({ data: { id, role: 'CLIENT', firstName } });
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('a) карточка → приглашение → join: данные переехали, карточка одна', async () => {
    const neg = await addCard('Мария К.');
    expect(neg < 0n).toBe(true);
    await seedCard(neg, 'мария-маркер');
    const ts = await as(TH).post(`/api/therapy/session-info/${neg}`, {
      therapyStartDate: '2026-03-03',
    });
    expect(ts.status).toBeLessThan(300);
    expect(await rowsOn(neg)).toEqual({
      notes: 1,
      concept: 1,
      maps: 1,
      tasks: 1,
    });

    expect(
      (await as(TH2).post(`/api/therapy/clients/${neg}/invite`)).status,
    ).toBe(403);
    expect((await as(TH).post(`/api/therapy/clients/${C}/invite`)).status).toBe(
      400,
    );

    const inv = await as(TH).post(`/api/therapy/clients/${neg}/invite`);
    expect(inv.status).toBe(201);
    expect(inv.body.code).toHaveLength(12);
    expect(inv.body.url).toEqual(expect.any(String));
    const again = await as(TH).post(`/api/therapy/clients/${neg}/invite`);
    expect(again.body.code).toBe(inv.body.code);

    const list = await as(TH).get('/api/therapy/invites');
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      alias: 'Мария К.',
      attachToId: Number(-neg),
    });

    const pre = await as(C).post('/api/therapy/invite/preview', {
      code: inv.body.code,
    });
    expect(pre.body).toEqual({ therapistName: 'Анна', connection: 'none' });
    expect(
      (await as(C).post('/api/therapy/join', { code: inv.body.code })).status,
    ).toBe(201);

    const clients = (await as(TH).get('/api/therapy/clients')).body;
    expect(clients).toHaveLength(1);
    expect(String(clients[0].telegramId)).toBe(String(C));
    expect(clients[0]).toMatchObject({
      clientAlias: 'Мария К.',
      therapyStartDate: '2026-03-03',
    });
    expect(clients.some((c: any) => Number(c.telegramId) < 0)).toBe(false);
    expect((await as(TH).get('/api/therapy/invites')).body).toEqual([]);

    const notes = await as(TH).get(`/api/therapy/notes/${C}`);
    expect(JSON.stringify(notes.body)).toContain('мария-маркер');
    const conc = await as(TH).get(`/api/therapy/conceptualization/${C}`);
    expect(conc.body.earlyExperience).toBe('мария-маркер');
    const maps = await as(TH).get(`/api/therapy/mode-maps/${C}`);
    expect(JSON.stringify(maps.body)).toContain('карта мария-маркер');
    const tasks = await as(TH).get(`/api/therapy/tasks/client/${C}`);
    expect(JSON.stringify(tasks.body)).toContain('задание мария-маркер');

    expect(await rowsOn(neg)).toEqual({
      notes: 0,
      concept: 0,
      maps: 0,
      tasks: 0,
    });
    expect(
      await prisma.therapyRelation.count({ where: { id: Number(-neg) } }),
    ).toBe(0);
    expect((await as(TH2).get(`/api/therapy/notes/${C}`)).status).toBe(403);
  });

  it('b) клиент уже подключён: данные сливаются, побеждает новее концептуализация', async () => {
    const inv0 = await as(TH).post('/api/therapy/invite');
    expect(
      (await as(D).post('/api/therapy/join', { code: inv0.body.code })).status,
    ).toBe(201);
    expect(
      (
        await as(TH).post(`/api/therapy/conceptualization/${D}`, {
          earlyExperience: 'старое',
        })
      ).status,
    ).toBeLessThan(300);

    const neg = await addCard('Дмитрий К.');
    await seedCard(neg, 'новее');
    // Фейк @updatedAt не ведёт, явное значение уважают оба — выставляем руками.
    await prisma.clientConceptualization.updateMany({
      where: { therapistId: TH, clientId: D },
      data: { updatedAt: new Date('2026-01-01T00:00:00Z') },
    });
    await prisma.clientConceptualization.updateMany({
      where: { therapistId: TH, clientId: neg },
      data: { updatedAt: new Date('2026-06-01T00:00:00Z') },
    });

    const inv = await as(TH).post(`/api/therapy/clients/${neg}/invite`);
    expect(inv.status).toBe(201);
    expect(
      (await as(D).post('/api/therapy/join', { code: inv.body.code })).status,
    ).toBe(201);

    const clients = (await as(TH).get('/api/therapy/clients')).body;
    expect(
      clients.filter((c: any) => String(c.telegramId) === String(D)),
    ).toHaveLength(1);
    expect(clients.some((c: any) => Number(c.telegramId) < 0)).toBe(false);
    const conc = await as(TH).get(`/api/therapy/conceptualization/${D}`);
    expect(conc.body.earlyExperience).toBe('новее');
    expect(
      JSON.stringify((await as(TH).get(`/api/therapy/notes/${D}`)).body),
    ).toContain('заметка новее');
    expect(
      await prisma.therapyRelation.count({ where: { id: Number(-neg) } }),
    ).toBe(0);
    expect((await as(TH).get('/api/therapy/invites')).body).toEqual([]);
    expect(await rowsOn(neg)).toEqual({
      notes: 0,
      concept: 0,
      maps: 0,
      tasks: 0,
    });
  });

  it('c) удаление карточки отзывает её приглашение', async () => {
    const neg = await addCard('Пётр');
    const inv = await as(TH).post(`/api/therapy/clients/${neg}/invite`);
    expect(inv.status).toBe(201);
    expect(
      (await as(TH).delete(`/api/therapy/clients/${neg}`)).status,
    ).toBeLessThan(300);
    expect((await as(TH).get('/api/therapy/invites')).body).toEqual([]);
    expect(
      (await as(P).post('/api/therapy/join', { code: inv.body.code })).status,
    ).toBe(400);
  });
});
