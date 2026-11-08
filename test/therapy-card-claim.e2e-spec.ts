// e2e: сверка «Это тот же человек?» для кода из офлайн-карточки (аудит
// 2026-11, S8; решение владельца Р3 2026-11-08). До неё кто угодно, введя код
// карточки, сразу получал её задания и карты режимов и показывался терапевту
// под её именем. Теперь: join создаёт связь, записи карточки остаются на
// -TherapyRelation.id и аккаунту не видны, пока терапевт не ответит «Да».
// Плюс S18: id кабинета за int32 → 400, удаление чужой заметки/режима → 404.
//
// Гоняется дважды: фейковая Prisma (джоба backend) и живой Postgres
// (E2E_REAL_DB=1, джоба migrations) — каскад attachToId при удалении
// карточки есть только на живой БД.
//
// Действующие лица: терапевты TH («Анна») и TH2; B («Борис») — аккаунт, к
// которому попал чужой код; M («Мария») — тот самый человек из карточки.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

const [TH, TH2, B, M] = [1n, 2n, 3n, 4n].map((n) => 4_410_000_000_000n + n);
const ALL = [TH, TH2, B, M];
jest.setTimeout(60_000);

describe('e2e: код офлайн-карточки — записи только после сверки терапевтом', () => {
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

  // Карточка с заданием и картой режимов, приглашение из неё → код.
  async function cardWithInvite(name: string, marker: string) {
    const res = await as(TH).post('/api/therapy/clients/virtual', { name });
    const neg = Number(res.body.find((c: any) => c.name === name).telegramId);
    const task = await as(TH).post('/api/therapy/tasks', {
      type: 'custom',
      text: `задание ${marker}`,
      clientId: neg,
    });
    expect(task.status).toBeLessThan(300);
    const map = await as(TH).post(`/api/therapy/mode-maps/${neg}`, {
      title: `карта ${marker}`,
    });
    expect(map.status).toBeLessThan(300);
    const inv = await as(TH).post(`/api/therapy/clients/${neg}/invite`);
    expect(inv.status).toBe(201);
    return { neg, cardId: -neg, code: inv.body.code as string };
  }
  // Всё, что клиент видит у себя: задания, их история и карты режимов.
  const clientView = async (who: bigint) =>
    JSON.stringify([
      (await as(who).get('/api/therapy/tasks')).body,
      (await as(who).get('/api/therapy/tasks/history')).body,
      (await as(who).get('/api/therapy/my-mode-maps')).body,
    ]);
  const clients = async () =>
    (await as(TH).get('/api/therapy/clients')).body as any[];
  const claims = async (who = TH) =>
    (await as(who).get('/api/therapy/card-claims')).body;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await prisma.user.create({
      data: { id: TH, role: 'THERAPIST', firstName: 'Анна' },
    });
    await prisma.user.create({ data: { id: TH2, role: 'THERAPIST' } });
    await prisma.user.create({
      data: { id: B, role: 'CLIENT', firstName: 'Борис' },
    });
    await prisma.user.create({
      data: { id: M, role: 'CLIENT', firstName: 'Мария' },
    });
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('чужой аккаунт с кодом: до ответа записей карточки не видит, «Нет» их не отдаёт', async () => {
    const card = await cardWithInvite('Мария К.', 'маркер-а');
    const join = await as(B).post('/api/therapy/join', { code: card.code });
    expect(join.status).toBe(201);

    expect(await clientView(B)).not.toContain('маркер-а');
    // Терапевт видит новую связь без имени карточки и саму карточку.
    const list = await clients();
    expect(list.find((c) => Number(c.telegramId) === Number(B))).toMatchObject({
      name: 'Борис',
      clientAlias: null,
    });
    expect(list.some((c) => Number(c.telegramId) === card.neg)).toBe(true);
    expect(await claims()).toEqual([
      {
        clientId: Number(B),
        clientName: 'Борис',
        cardId: card.cardId,
        cardName: 'Мария К.',
      },
    ]);
    // Код одноразовый: после ввода его нет в «Ждут подключения».
    expect((await as(TH).get('/api/therapy/invites')).body).toEqual([]);

    // Чужие не видят и не отвечают; клиент — не терапевт.
    const yes = { cardId: card.cardId, accept: true };
    expect(await claims(TH2)).toEqual([]);
    expect(
      (await as(TH2).post(`/api/therapy/card-claims/${B}`, yes)).status,
    ).toBe(404);
    expect((await as(B).get('/api/therapy/card-claims')).status).toBe(403);
    expect(
      (await as(B).post(`/api/therapy/card-claims/${B}`, yes)).status,
    ).toBe(403);
    const bad = [
      [`/api/therapy/card-claims/-3000000000`, yes, 400],
      [`/api/therapy/card-claims/${B}`, { cardId: card.cardId }, 400],
      [
        `/api/therapy/card-claims/${B}`,
        { cardId: 3000000000, accept: true },
        400,
      ],
      [
        `/api/therapy/card-claims/${B}`,
        { cardId: card.cardId + 1, accept: true },
        404,
      ],
    ] as const;
    for (const [url, body, status] of bad)
      expect((await as(TH).post(url, body)).status).toBe(status);
    expect(await clientView(B)).not.toContain('маркер-а');

    const no = await as(TH).post(`/api/therapy/card-claims/${B}`, {
      cardId: card.cardId,
      accept: false,
    });
    expect(no.status).toBe(201);
    expect(await claims()).toEqual([]);
    expect(await clientView(B)).not.toContain('маркер-а');
    // Карточка осталась офлайн со своими записями.
    const own = await as(TH).get(`/api/therapy/tasks/client/${card.neg}`);
    expect(JSON.stringify(own.body)).toContain('маркер-а');
    expect(
      (await as(TH).post(`/api/therapy/card-claims/${B}`, yes)).status,
    ).toBe(404);
  });

  it('тот самый человек: «Да» — задания и карта карточки у него в приложении', async () => {
    const card = await cardWithInvite('Мария', 'маркер-б');
    expect(
      (await as(M).post('/api/therapy/join', { code: card.code })).status,
    ).toBe(201);
    expect(await clientView(M)).not.toContain('маркер-б');

    const ok = await as(TH).post(`/api/therapy/card-claims/${M}`, {
      cardId: card.cardId,
      accept: true,
    });
    expect(ok.status).toBe(201);
    const view = await clientView(M);
    expect(view).toContain('задание маркер-б');
    expect(view).toContain('карта маркер-б');
    const mine = (await clients()).find(
      (c) => Number(c.telegramId) === Number(M),
    );
    expect(mine.clientAlias).toBe('Мария');
    expect(
      (await clients()).some((c) => Number(c.telegramId) === card.neg),
    ).toBe(false);
  });

  it('уже подключённый вводит код другой карточки: без ответа не сливается; удаление карточки связь не трогает', async () => {
    const card = await cardWithInvite('Пётр', 'маркер-в');
    expect(
      (await as(B).post('/api/therapy/join', { code: card.code })).status,
    ).toBe(201);
    expect(await clientView(B)).not.toContain('маркер-в');
    expect(
      (await clients()).some((c) => Number(c.telegramId) === card.neg),
    ).toBe(true);
    expect(await claims()).toEqual([
      expect.objectContaining({ clientId: Number(B), cardId: card.cardId }),
    ]);

    // Каскад attachToId снёс бы связь Б вместе с карточкой (живая БД).
    const del = await as(TH).delete(`/api/therapy/clients/${card.neg}`);
    expect(del.status).toBeLessThan(300);
    expect(await claims()).toEqual([]);
    expect(
      (await clients()).some((c) => Number(c.telegramId) === Number(B)),
    ).toBe(true);
    expect((await as(B).get('/api/therapy/relation')).body).toMatchObject({
      role: 'client',
      status: 'active',
    });
  });

  it('код одной карточки ввели два аккаунта: «Да» одному не сносит связь другого', async () => {
    const card = await cardWithInvite('Вера', 'маркер-г');
    expect(
      (await as(B).post('/api/therapy/join', { code: card.code })).status,
    ).toBe(201);
    // Первый код погас — повторный «Пригласить» выдаёт новый.
    const again = await as(TH).post(`/api/therapy/clients/${card.neg}/invite`);
    expect(again.body.code).not.toBe(card.code);
    expect(
      (await as(M).post('/api/therapy/join', { code: again.body.code })).status,
    ).toBe(201);
    expect(await claims()).toHaveLength(2);

    const ok = await as(TH).post(`/api/therapy/card-claims/${M}`, {
      cardId: card.cardId,
      accept: true,
    });
    expect(ok.status).toBe(201);
    expect(await claims()).toEqual([]);
    expect(await clientView(M)).toContain('маркер-г');
    expect(await clientView(B)).not.toContain('маркер-г');
    expect(
      (await clients()).some((c) => Number(c.telegramId) === Number(B)),
    ).toBe(true);
  });

  it('S18: id за int32 → 400; удаление чужой или несуществующей заметки и режима → 404', async () => {
    const note = await as(TH).post(`/api/therapy/notes/${M}`, {
      date: '2026-09-01',
      text: 'заметка',
    });
    expect(note.status).toBeLessThan(300);
    const noteId = note.body.id;
    expect((await as(TH2).delete(`/api/therapy/notes/${noteId}`)).status).toBe(
      404,
    );
    expect((await as(TH).delete('/api/therapy/notes/999999')).status).toBe(404);
    expect((await as(TH).delete('/api/therapy/notes/3000000000')).status).toBe(
      400,
    );
    expect((await as(TH).delete(`/api/therapy/notes/${noteId}`)).status).toBe(
      200,
    );

    const mode = await as(TH).post('/api/therapy/custom-modes', {
      name: 'Мой Критик',
    });
    expect(mode.status).toBeLessThan(300);
    const modeUrl = `/api/therapy/custom-modes/${mode.body.id}`;
    expect((await as(TH2).delete(modeUrl)).status).toBe(404);
    expect((await as(TH).delete(modeUrl)).status).toBe(200);
    expect((await as(TH).delete(modeUrl)).status).toBe(404);

    for (const url of [
      '/api/therapy/notes/-3000000000',
      '/api/therapy/mode-maps/-3000000000',
      '/api/therapy/mode-maps/map/3000000000',
    ])
      expect((await as(TH).get(url)).status).toBe(400);
  });
});
