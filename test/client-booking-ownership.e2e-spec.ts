// e2e SMOKE: запись клиента из приложения (#546) — новый контроллер
// ClientBookingController. Инварианты по HTTP через настоящий AppModule:
//   1) раздел видит и записаться может только клиент с активной связью с
//      владельцем практики (ADMIN_ID): клиент чужого терапевта и человек без
//      связи получают eligible: false и 403 на запись;
//   2) GET отдаёт ТОЛЬКО свои брони (по userId из гарда), а не соседа;
//   3) без входа — 401.
// Создание брони берёт advisory-lock через $executeRaw — это проверяется
// только на живом Postgres (джоба `migrations`, E2E_REAL_DB=1, правило №18);
// на фейке тот тест честно помечен skipped, как в login-ticket.e2e-spec.ts.
process.env.ADMIN_ID = '7770000001';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { ClientBookingService } from '../src/booking/client-booking.service';

const REAL_DB = process.env.E2E_REAL_DB === '1';
const itOnRealDb = REAL_DB ? it : it.skip;

describe('e2e smoke: запись клиента из приложения (ownership)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const secret = () => process.env.JWT_SECRET as string;

  const OWNER = 7_770_000_001n; // владелец практики = ADMIN_ID
  const A = 7_770_000_002n; // клиент владельца
  const B = 7_770_000_003n; // второй клиент владельца
  const T2 = 7_770_000_004n; // другой терапевт
  const C = 7_770_000_005n; // клиент другого терапевта
  const S = 7_770_000_006n; // без связи
  const ALL = [OWNER, A, B, T2, C, S];
  const TOKEN_A = 'cb-e2e-token-a';
  const TOKEN_B = 'cb-e2e-token-b';
  const FUTURE = new Date('2095-03-07T10:00:00.000Z');
  const SLOT = new Date('2095-03-08T10:00:00.000Z');

  const cleanup = async () => {
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { userId: { in: ALL } },
          { cancelToken: { in: [TOKEN_A, TOKEN_B] } },
          { startsAt: SLOT },
        ],
      },
    });
    await cleanupOwnershipFixtures(prisma, ALL);
  };

  function agentAs(userId: bigint) {
    const token = signAccessToken(userId, secret());
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(request(app.getHttpServer()).get(url)),
      post: (url: string, body: object = {}) =>
        auth(request(app.getHttpServer()).post(url)).send(body),
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

  const booking = (userId: bigint, cancelToken: string, hour: number) => ({
    data: {
      startsAt: new Date(FUTURE.getTime() + hour * 3_600_000),
      durationMin: 50,
      type: 'SESSION_50',
      status: 'CONFIRMED',
      clientName: 'e2e',
      clientContact: `tg://user?id=${userId}`,
      cancelToken,
      userId,
    },
  });

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanup();
    await prisma.user.create({ data: { id: OWNER, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: T2, role: 'THERAPIST' } });
    for (const id of [A, B, C, S])
      await prisma.user.create({ data: { id, role: 'CLIENT' } });
    await connect(OWNER, A);
    await connect(OWNER, B);
    await connect(T2, C);
    await prisma.booking.create(booking(A, TOKEN_A, 0));
    await prisma.booking.create(booking(B, TOKEN_B, 2));
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('без входа — 401 на обе ручки', async () => {
    const server = request(app.getHttpServer());
    expect((await server.get('/api/client-booking')).status).toBe(401);
    const post = await request(app.getHttpServer())
      .post('/api/client-booking/book')
      .send({ startsAt: SLOT.toISOString() });
    expect(post.status).toBe(401);
  });

  it('клиент владельца видит раздел и ТОЛЬКО свою бронь', async () => {
    const res = await agentAs(A).get('/api/client-booking');
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
    expect(res.body.upcoming).toHaveLength(1);
    expect(res.body.upcoming[0].manageUrl).toContain(TOKEN_A);
    expect(JSON.stringify(res.body)).not.toContain(TOKEN_B);
    // Без PII: имя и контакт брони наружу не отдаются.
    expect(res.body.upcoming[0]).not.toHaveProperty('clientContact');
  });

  it.each([
    ['клиент другого терапевта', C],
    ['человек без связи', S],
  ])('%s: раздела нет, запись — 403, чужих броней не видно', async (_, id) => {
    const view = await agentAs(id).get('/api/client-booking');
    expect(view.body).toEqual({ eligible: false, upcoming: [] });
    const post = await agentAs(id).post('/api/client-booking/book', {
      startsAt: SLOT.toISOString(),
    });
    expect(post.status).toBe(403);
    const rows = await prisma.booking.findMany({ where: { userId: id } });
    expect(rows).toHaveLength(0);
  });

  it('тело не может подменить аккаунт: userId из тела срезается', async () => {
    const post = await agentAs(S).post('/api/client-booking/book', {
      startsAt: SLOT.toISOString(),
      userId: String(A),
    });
    expect(post.status).toBe(403);
  });

  // R9: выбор валюты при поясе без места доходит до сервиса через настоящий
  // ValidationPipe (whitelist срезал бы поле, которого нет в DTO); мусор — 400.
  it('выбор валюты проходит DTO и контроллер; валюта не из списка — 400', async () => {
    const svc = app.get(ClientBookingService);
    const spy = jest.spyOn(svc, 'book').mockResolvedValue({
      id: 1,
      cancelToken: 'cb-e2e-spy',
      heldUntil: null,
      status: 'CONFIRMED',
      paymentUrl: null,
      eventDurationMin: 50,
      manageUrl: 'https://kotlarewski.gr/booking/manage?token=cb-e2e-spy',
    });
    try {
      const ok = await agentAs(A).post('/api/client-booking/book', {
        startsAt: SLOT.toISOString(),
        clientTimeZone: 'UTC',
        currency: 'EUR',
      });
      expect(ok.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(
        A,
        expect.objectContaining({ clientTimeZone: 'UTC', currency: 'EUR' }),
      );
      const bad = await agentAs(A).post('/api/client-booking/book', {
        startsAt: SLOT.toISOString(),
        currency: 'XXX',
      });
      expect(bad.status).toBe(400);
      expect(JSON.stringify(bad.body)).toContain('currency');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  itOnRealDb(
    'клиент записывается: бронь привязана к его аккаунту и видна только ему',
    async () => {
      const post = await agentAs(A).post('/api/client-booking/book', {
        startsAt: SLOT.toISOString(),
        durationMin: 50,
        clientTimeZone: 'Europe/Moscow',
      });
      expect(post.status).toBe(200);
      expect(post.body.status).toBe('HELD');
      expect(post.body.paymentUrl).toEqual(
        expect.stringContaining('robokassa'),
      );
      const [row] = await prisma.booking.findMany({
        where: { startsAt: SLOT },
      });
      expect(row.userId).toBe(A);
      expect(row.clientTelegramId).toBe(A);
      const forB = await agentAs(B).get('/api/client-booking');
      expect(JSON.stringify(forB.body)).not.toContain(post.body.cancelToken);
    },
  );
});
