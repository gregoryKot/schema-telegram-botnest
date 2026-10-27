// e2e: приглашение клиента терапевтом (инцидент 2026-10-26, QA-проход на
// локальном стенде). Три поломки одного пути, все через настоящий AppModule:
//  1. по коду не подключался никто — сервер выдавал 12 знаков, поле ввода
//     пускало 8 (здесь — код с пробелами и строчными тоже принимается);
//  2. два приглашения подряд отдавали ОДИН код — второй клиент получал
//     «неверный код», терапевт не узнавал;
//  3. «+ Новый клиент» с приглашением давал две карточки (офлайн «Мария К.»
//     и подключившаяся «Мария»).
// Плюс владение: список и отзыв приглашений — только свои.
//
// Гоняется дважды: фейковая Prisma (джоба backend) и живой Postgres
// (E2E_REAL_DB=1, джоба migrations): `clientId IS NULL`, `createdAt >=` и
// сортировка — ровно то, где фейк уже расходился с базой.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

const [TH, TH2, A, B, C] = [1n, 2n, 3n, 4n, 5n].map(
  (n) => 4_200_000_000_000n + n,
);
const ALL = [TH, TH2, A, B, C];
jest.setTimeout(60_000);

describe('e2e: приглашение клиента терапевтом', () => {
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

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await prisma.user.create({
      data: { id: TH, role: 'THERAPIST', firstName: 'Анна' },
    });
    await prisma.user.create({ data: { id: TH2, role: 'THERAPIST' } });
    for (const [id, firstName] of [
      [A, 'Олег'],
      [B, 'Ирина'],
      [C, 'Мария'],
    ] as const)
      await prisma.user.create({ data: { id, role: 'CLIENT', firstName } });
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('два приглашения подряд — разные коды, оба клиента подключаются', async () => {
    const first = await as(TH).post('/api/therapy/invite');
    const second = await as(TH).post('/api/therapy/invite');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.code).toHaveLength(12);
    expect(second.body.code).not.toBe(first.body.code);

    // Код так, как его переписывают руками: строчные и пробелы по краям.
    const joinA = await as(A).post('/api/therapy/join', {
      code: ` ${(first.body.code as string).toLowerCase()} `,
    });
    const joinB = await as(B).post('/api/therapy/join', {
      code: second.body.code,
    });
    expect(joinA.status).toBe(201);
    expect(joinB.status).toBe(201);

    const clients = await as(TH).get('/api/therapy/clients');
    expect(clients.status).toBe(200);
    expect(
      (clients.body as { telegramId: string | number }[])
        .map((c) => String(c.telegramId))
        .sort(),
    ).toEqual([A.toString(), B.toString()].sort());
  });

  it('приглашение из «Новый клиент» → ждёт в списке → после подключения ОДНА карточка с этим именем', async () => {
    const created = await as(TH).post('/api/therapy/invite', {
      alias: 'Мария К.',
    });
    expect(created.status).toBe(201);

    const pending = await as(TH).get('/api/therapy/invites');
    expect(pending.status).toBe(200);
    expect(pending.body).toEqual([
      expect.objectContaining({ code: created.body.code, alias: 'Мария К.' }),
    ]);

    // Клиент до согласия видит, чей это код.
    const preview = await as(C).post('/api/therapy/invite/preview', {
      code: created.body.code,
    });
    expect(preview.status).toBe(201);
    expect(preview.body).toEqual({ therapistName: 'Анна' });

    const join = await as(C).post('/api/therapy/join', {
      code: created.body.code,
    });
    expect(join.status).toBe(201);

    const clients = (await as(TH).get('/api/therapy/clients')).body as {
      telegramId: string | number;
      name: string;
      clientAlias: string | null;
    }[];
    const maria = clients.filter(
      (c) => c.name === 'Мария' || c.clientAlias === 'Мария К.',
    );
    expect(maria).toHaveLength(1);
    // id ниже 2^53 приезжает числом, выше — строкой (therapy-web-client e2e).
    expect(String(maria[0].telegramId)).toBe(C.toString());
    expect(maria[0].clientAlias).toBe('Мария К.');
    // Принятое приглашение из списка ждущих ушло.
    expect((await as(TH).get('/api/therapy/invites')).body).toEqual([]);
  });

  it('предпросмотр принятого и выдуманного кода — 400, как у подключения', async () => {
    const used = await prisma.therapyRelation.findFirst({
      where: { therapistId: TH, clientId: C },
    });
    for (const code of [used!.code, 'FFFFFFFFFFFF'])
      expect(
        (await as(B).post('/api/therapy/invite/preview', { code })).status,
      ).toBe(400);
  });

  it('список и отзыв — только свои: чужой терапевт не видит и не отзывает', async () => {
    const mine = await as(TH).post('/api/therapy/invite', { alias: 'Пётр' });
    const row = await prisma.therapyRelation.findFirst({
      where: { code: mine.body.code },
    });

    const theirs = await as(TH2).get('/api/therapy/invites');
    expect(theirs.status).toBe(200);
    expect(theirs.body).toEqual([]);
    expect(
      (await as(TH2).delete(`/api/therapy/invites/${row!.id}`)).status,
    ).toBe(404);
    // Клиент списка не получает вовсе.
    expect((await as(A).get('/api/therapy/invites')).status).toBe(403);

    expect(
      (await as(TH).delete(`/api/therapy/invites/${row!.id}`)).status,
    ).toBe(200);
    expect((await as(TH).get('/api/therapy/invites')).body).toEqual([]);
    // Отозванным кодом не подключиться.
    const late = await as(B).post('/api/therapy/join', {
      code: mine.body.code,
    });
    expect(late.status).toBe(400);
  });
});
