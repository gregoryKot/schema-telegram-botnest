// e2e SMOKE — extends app-ownership.e2e-spec.ts (which covers schema/mode
// notes) to the rest of the user-data surface: tracker ratings, the three
// diary types, practices/plans, the belief-check/letter/safe-place/flashcard
// tools, and the YSQ test. Same build-test-app.ts (real AppModule, fake
// Prisma + bot). Every case: user A creates a row, user B hits the same GET
// and must never see it — filtering by userId must reach the HTTP response,
// not just the fake-prisma call args.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';

describe('e2e smoke: ownership isolation sweep (tracker/diary/plans/exercises/ysq)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const secret = () => process.env.JWT_SECRET as string;
  const USER_A = 3_000_000_000_000_001n;
  const USER_B = 3_000_000_000_000_002n;

  function agentAs(userId: bigint) {
    const token = signAccessToken(userId, secret());
    return {
      get: (url: string) =>
        request(app.getHttpServer())
          .get(url)
          .set('Authorization', `Bearer ${token}`),
      post: (url: string, body: object) =>
        request(app.getHttpServer())
          .post(url)
          .set('Authorization', `Bearer ${token}`)
          .send(body),
    };
  }

  // Endpoints whose GET returns an array of the caller's own rows. Each entry
  // creates exactly one row as user A, then asserts user B's list is empty.
  const ARRAY_ENDPOINTS: Array<{
    label: string;
    create: (a: ReturnType<typeof agentAs>) => Promise<request.Response>;
    list: string;
  }> = [
    {
      label: 'diary/schema',
      create: (a) =>
        a.post('/api/diary/schema', {
          trigger: 't',
          emotions: [],
          schemaIds: ['abandonment'],
        }),
      list: '/api/diary/schema',
    },
    {
      label: 'diary/mode',
      create: (a) =>
        a.post('/api/diary/mode', {
          modeId: 'vulnerable_child',
          situation: 's',
        }),
      list: '/api/diary/mode',
    },
    {
      label: 'diary/gratitude',
      create: (a) =>
        a.post('/api/diary/gratitude', { date: '2099-01-02', items: ['x'] }),
      list: '/api/diary/gratitude',
    },
    {
      label: 'practices',
      create: (a) =>
        a.post('/api/practices', { needId: 'attachment', text: 'breathe' }),
      list: '/api/practices?needId=attachment',
    },
    {
      label: 'plan/pending',
      create: (a) =>
        a.post('/api/plan', { needId: 'attachment', practiceText: 'walk' }),
      list: '/api/plan/pending',
    },
    {
      label: 'belief-checks',
      create: (a) =>
        a.post('/api/belief-checks', {
          belief: 'b',
          evidenceFor: ['a'],
          evidenceAgainst: ['c'],
        }),
      list: '/api/belief-checks',
    },
    {
      label: 'letters',
      create: (a) => a.post('/api/letters', { text: 'dear me' }),
      list: '/api/letters',
    },
    {
      label: 'flashcards',
      create: (a) =>
        a.post('/api/flashcards', {
          modeId: 'vulnerable_child',
          needId: 'attachment',
        }),
      list: '/api/flashcards',
    },
    {
      label: 'ysq-history',
      create: (a) => a.post('/api/ysq-result', { answers: Array(116).fill(3) }),
      list: '/api/ysq-history',
    },
  ];

  it.each(ARRAY_ENDPOINTS)(
    '$label: user B never sees user A rows in the list',
    async ({ create, list }) => {
      const a = agentAs(USER_A);
      const b = agentAs(USER_B);

      const created = await create(a);
      expect(created.status).toBeLessThan(300);

      const asOwner = await a.get(list);
      expect(asOwner.status).toBe(200);
      expect(Array.isArray(asOwner.body)).toBe(true);
      expect(asOwner.body.length).toBeGreaterThan(0);

      const asOther = await b.get(list);
      expect(asOther.status).toBe(200);
      expect(asOther.body).toEqual([]);
    },
  );

  // Endpoints with a distinct response shape not covered by the array sweep
  // above: ratings is a needId→value map, safe-place/ysq-progress/ysq-result
  // are singleton rows (findUnique, not findMany).

  it('ratings: user B does not see user A ratings for the same date', async () => {
    const a = agentAs(USER_A);
    const b = agentAs(USER_B);
    const date = '2099-01-01';

    const created = await a.post('/api/rating', {
      needId: 'attachment',
      value: 7,
      date,
    });
    expect(created.status).toBeLessThan(300);

    const asOwner = await a.get(`/api/ratings?date=${date}`);
    expect(asOwner.body).toEqual({ attachment: 7 });

    const asOther = await b.get(`/api/ratings?date=${date}`);
    expect(asOther.body).toEqual({});
  });

  // Nest serialises a `null` controller return as an EMPTY body (not JSON
  // "null"), so supertest parses it as `{}` — assert on `.text` instead of
  // `.body` for the "nothing here" case.
  it('safe-place: user B gets nothing where user A has a saved description', async () => {
    const a = agentAs(USER_A);
    const b = agentAs(USER_B);

    const created = await a.post('/api/safe-place', { description: 'beach' });
    expect(created.status).toBeLessThan(300);

    const asOwner = await a.get('/api/safe-place');
    expect(asOwner.body.description).toBe('beach');

    const asOther = await b.get('/api/safe-place');
    expect(asOther.status).toBe(200);
    expect(asOther.text).toBe('');
  });

  it('ysq-progress: user B gets nothing where user A has in-progress answers', async () => {
    const a = agentAs(USER_A);
    const b = agentAs(USER_B);

    const created = await a.post('/api/ysq-progress', {
      answers: Array(116).fill(2),
      page: 3,
    });
    expect(created.status).toBeLessThan(300);

    const asOwner = await a.get('/api/ysq-progress');
    expect(asOwner.body.page).toBe(3);

    const asOther = await b.get('/api/ysq-progress');
    expect(asOther.text).toBe('');
  });

  it('ysq-result: user B gets nothing where user A has a completed result', async () => {
    const a = agentAs(USER_A);
    const b = agentAs(USER_B);

    const created = await a.post('/api/ysq-result', {
      answers: Array(116).fill(4),
    });
    expect(created.status).toBeLessThan(300);

    const asOwner = await a.get('/api/ysq-result');
    expect(asOwner.body.answers).toHaveLength(116);

    const asOther = await b.get('/api/ysq-result');
    expect(asOther.text).toBe('');
  });
});
