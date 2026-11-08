// e2e частичного сохранения концептуализации с версией строки
// (POST /api/therapy/conceptualization/:clientId, src/therapy/concept-save.ts):
//  - худший патч (все поля до предела, по CONCEPT_PATCH_LINKS_MAX связей с
//    отметками до предела) проходит, полное тело на пределе — 413;
//  - гонка двух окон: второе сохранение от той же версии — 409, повтор от
//    свежей — проходит, GET видит обе правки («сохранил → нашёл»);
//  - чужой терапевт патч не пишет (ownership).
// Гоняется на фейковой Prisma (джоба backend) и на живом Postgres (migrations).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import {
  worstFullBody,
  worstPatchBody,
} from '../src/test-support/concept-worst-body';
import { CONCEPT_PATCH_LINKS_MAX } from '../src/therapy/dto/concept-save.dto';

jest.setTimeout(60_000);

describe('e2e: частичное сохранение концептуализации с версией строки', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const T = 4_310_000_000_000_001n;
  const C = 4_310_000_000_000_002n;
  const T2 = 4_310_000_000_000_003n;
  const ALL = [T, C, T2];
  const url = `/api/therapy/conceptualization/${C}`;

  const as = (userId: bigint) => {
    const token = signAccessToken(userId, process.env.JWT_SECRET as string);
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const http = () => request(app.getHttpServer());
    return {
      get: (u: string) => auth(http().get(u)),
      post: (u: string, body: object = {}) => auth(http().post(u)).send(body),
    };
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await prisma.user.create({ data: { id: T, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: C, role: 'CLIENT' } });
    await prisma.user.create({ data: { id: T2, role: 'THERAPIST' } });
    const invite = await as(T).post('/api/therapy/invite');
    const join = await as(C).post('/api/therapy/join', {
      code: invite.body.code,
    });
    expect(join.status).toBeLessThan(300);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('первое сохранение от «строки ещё нет» создаёт её и отдаёт версию', async () => {
    const r = await as(T).post(url, { baseVersion: null, goals: 'опора' });
    expect(r.status).toBeLessThan(300);
    expect(typeof r.body.updatedAt).toBe('string');
  });

  it('худший патч проходит, GET видит его связи; полное тело на пределе — 413', async () => {
    const base = (await as(T).get(url)).body.updatedAt as string;
    const r = await as(T).post(url, { ...worstPatchBody(), baseVersion: base });
    expect(r.status).toBeLessThan(300);
    const got = (await as(T).get(url)).body;
    expect(got.modeLinks).toHaveLength(CONCEPT_PATCH_LINKS_MAX);
    expect(got.schemaLinks).toHaveLength(CONCEPT_PATCH_LINKS_MAX);
    expect(got.modeLinks[0].done.length).toBeGreaterThan(0);

    const full = await as(T).post(url, worstFullBody());
    expect(full.status).toBe(413);
  });

  it('гонка двух окон: от устаревшей версии — 409, повтор от свежей — обе правки на месте', async () => {
    const v1 = (await as(T).get(url)).body.updatedAt as string;
    const a = await as(T).post(url, {
      baseVersion: v1,
      goals: 'правка окна A',
    });
    expect(a.status).toBeLessThan(300);
    const b = await as(T).post(url, {
      baseVersion: v1,
      triggers: 'правка окна B',
    });
    expect(b.status).toBe(409);
    const retry = await as(T).post(url, {
      baseVersion: a.body.updatedAt,
      triggers: 'правка окна B',
    });
    expect(retry.status).toBeLessThan(300);
    const got = (await as(T).get(url)).body;
    expect(got.goals).toBe('правка окна A');
    expect(got.triggers).toBe('правка окна B');
  });

  it('чужой терапевт патч не пишет — 403, строка не тронута', async () => {
    const before = (await as(T).get(url)).body.updatedAt;
    const r = await as(T2).post(url, {
      modeLinksPatch: { remove: ['m0'.padEnd(64, 'x')] },
    });
    expect(r.status).toBe(403);
    expect((await as(T).get(url)).body.updatedAt).toBe(before);
  });
});
