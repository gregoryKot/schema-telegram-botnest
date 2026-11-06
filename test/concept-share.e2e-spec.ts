// e2e ownership: схема случая клиенту (тумблер «Показать клиенту»).
// PATCH /api/therapy/conceptualization/:clientId/share — только терапевт ЭТОЙ
// связи; GET /api/therapy/my-concept — клиенту только своя схема, только пока
// показ включён, и только видом клиента (без истоков, задач терапии, рабочих
// полей и истории). Две пары терапевт/клиент: T1–C1 и T2–C2. Гоняется на
// фейковой Prisma (джоба backend) и на живом Postgres (джоба migrations).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e ownership: схема случая клиенту (concept share)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const T1 = 4_300_000_000_000_001n;
  const C1 = 4_300_000_000_000_002n;
  const T2 = 4_300_000_000_000_003n;
  const C2 = 4_300_000_000_000_004n;
  const ALL = [T1, C1, T2, C2];

  const agentAs = (userId: bigint) => {
    const token = signAccessToken(userId, process.env.JWT_SECRET as string);
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const http = () => request(app.getHttpServer());
    return {
      get: (url: string) => auth(http().get(url)),
      post: (url: string, body: object = {}) =>
        auth(http().post(url)).send(body),
      patch: (url: string, body: object = {}) =>
        auth(http().patch(url)).send(body),
    };
  };

  async function connect(therapist: bigint, client: bigint) {
    const invite = await agentAs(therapist).post('/api/therapy/invite');
    expect(invite.status).toBeLessThan(300);
    const join = await agentAs(client).post('/api/therapy/join', {
      code: invite.body.code,
    });
    expect(join.status).toBeLessThan(300);
  }

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await prisma.user.create({ data: { id: T1, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: C1, role: 'CLIENT' } });
    await prisma.user.create({ data: { id: T2, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: C2, role: 'CLIENT' } });
    await connect(T1, C1);
    await connect(T2, C2);
    const saved = await agentAs(T1).post(
      `/api/therapy/conceptualization/${C1}`,
      {
        schemaIds: ['abandonment'],
        modeIds: ['vulnerable_child'],
        earlyExperience: 'ИСТОКИ: мама уходила',
        goals: 'ЗАДАЧА ТЕРАПИИ: опора',
        modeTransitions: 'Страх → уход в себя',
        modeLinks: [
          {
            modeId: 'vulnerable_child',
            alias: 'Маленькая',
            schemaIds: ['abandonment'],
            needIds: ['attachment'],
            origin: 'ИСТОКИ режима',
            manifest: 'Страшно',
            strategy: 'ЗАДАЧА ТЕРАПИИ режима',
          },
        ],
        schemaLinks: [
          {
            schemaId: 'abandonment',
            belief: 'Меня бросят',
            origin: 'ИСТОКИ схемы',
            needIds: ['attachment'],
          },
        ],
      },
    );
    expect(saved.status).toBeLessThan(300);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('по умолчанию схема не показана: клиенту 404, в «Мой терапевт» строки нет', async () => {
    expect((await agentAs(C1).get('/api/therapy/my-concept')).status).toBe(404);
    const rel = await agentAs(C1).get('/api/therapy/relation');
    expect(rel.body.conceptSharedAt ?? null).toBeNull();
  });

  it('чужой терапевт не включит показ (403), клиент — тоже (403), кривое тело — 400', async () => {
    expect(
      (
        await agentAs(T2).patch(`/api/therapy/conceptualization/${C1}/share`, {
          shared: true,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await agentAs(C1).patch(`/api/therapy/conceptualization/${C1}/share`, {
          shared: true,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await agentAs(T1).patch(`/api/therapy/conceptualization/${C1}/share`, {
          shared: 'yes',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await agentAs(T1).patch(
          `/api/therapy/conceptualization/${C1}/share`,
          {},
        )
      ).status,
    ).toBe(400);
    expect((await agentAs(C1).get('/api/therapy/my-concept')).status).toBe(404);
  });

  it('терапевт связи включил — клиент видит схему без истоков, задач терапии и истории', async () => {
    const on = await agentAs(T1).patch(
      `/api/therapy/conceptualization/${C1}/share`,
      { shared: true },
    );
    expect(on.status).toBe(200);
    expect(on.body.sharedWithClientAt).toEqual(expect.any(String));

    const mine = await agentAs(C1).get('/api/therapy/my-concept');
    expect(mine.status).toBe(200);
    // Только белый список (updatedAt фейк-Prisma этой таблице не ставит — на
    // живом Postgres он есть, поэтому сверка «не шире списка», а не равенство).
    const allowed = [
      'modeIds',
      'modeLinks',
      'modeTransitions',
      'schemaIds',
      'schemaLinks',
      'sharedWithClientAt',
      'updatedAt',
    ];
    expect(Object.keys(mine.body).filter((k) => !allowed.includes(k))).toEqual(
      [],
    );
    expect(mine.body).toMatchObject({
      schemaIds: ['abandonment'],
      modeIds: ['vulnerable_child'],
      modeTransitions: 'Страх → уход в себя',
    });
    expect(mine.body.modeLinks).toEqual([
      {
        modeId: 'vulnerable_child',
        alias: 'Маленькая',
        schemaIds: ['abandonment'],
        needIds: ['attachment'],
        manifest: 'Страшно',
      },
    ]);
    expect(mine.body.schemaLinks).toEqual([
      {
        schemaId: 'abandonment',
        belief: 'Меня бросят',
        needIds: ['attachment'],
      },
    ]);
    expect(JSON.stringify(mine.body)).not.toMatch(/ИСТОКИ|ЗАДАЧА ТЕРАПИИ/);

    const rel = await agentAs(C1).get('/api/therapy/relation');
    expect(rel.body.conceptSharedAt).toBe(on.body.sharedWithClientAt);
    // Терапевт видит положение тумблера в своей концептуализации.
    const own = await agentAs(T1).get(`/api/therapy/conceptualization/${C1}`);
    expect(own.body.sharedWithClientAt).toBe(on.body.sharedWithClientAt);
  });

  it('клиент другой связи чужую схему не получает (404)', async () => {
    expect((await agentAs(C2).get('/api/therapy/my-concept')).status).toBe(404);
  });

  it('терапевт выключил — клиент сразу перестаёт видеть', async () => {
    const off = await agentAs(T1).patch(
      `/api/therapy/conceptualization/${C1}/share`,
      { shared: false },
    );
    expect(off.status).toBe(200);
    expect(off.body.sharedWithClientAt).toBeNull();
    expect((await agentAs(C1).get('/api/therapy/my-concept')).status).toBe(404);
    const own = await agentAs(T1).get(`/api/therapy/conceptualization/${C1}`);
    expect(own.body.sharedWithClientAt ?? null).toBeNull();
  });
});
