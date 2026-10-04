// e2e (аудит 2026-10, X-1): клиент, вошедший через Google/VK/MAX/почту, живёт
// в диапазоне User.id [1e18, 9e18) — выше Number.MAX_SAFE_INTEGER. Раньше
// `BigInt.prototype.toJSON → Number` и `Number(clientId)` в therapy/pairs
// округляли такой id: терапевт получал «соседний» номер, и каждый следующий
// запрос с ним не проходил assertRelation — терапия и пары не работали ни у
// одного веб-клиента. Юнит-спеки этого не ловили: сервисы получали bigint,
// а округляли контроллер, сериализатор и парсер пути — то есть швы.
//
// Тут весь путь через настоящий AppModule: invite → join → список клиентов
// (id строкой) → запросы с этим id в пути и теле → обратно в БД точно.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e: терапия и пары с веб-клиентом (User.id > 2^53)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const secret = () => process.env.JWT_SECRET as string;

  const THERAPIST = 4_100_000_000_000_001n; // Telegram-подобный id
  const WEB = 1000000000000000123n; // веб-клиент: в Number не помещается
  const WEB_STR = '1000000000000000123';
  const FRIEND = 4_100_000_000_000_002n;
  const NEIGHBOUR = 1000000000000000124n; // соседний id — Number(WEB) их не различает
  const ALL_USER_IDS = [THERAPIST, WEB, FRIEND, NEIGHBOUR];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await prisma.user.create({ data: { id: THERAPIST, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: WEB, role: 'CLIENT' } });
    await prisma.user.create({ data: { id: FRIEND, role: 'CLIENT' } });
    await prisma.user.create({ data: { id: NEIGHBOUR, role: 'CLIENT' } });
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await app.close();
  });

  function agentAs(userId: bigint) {
    const token = signAccessToken(userId, secret());
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(request(app.getHttpServer()).get(url)),
      post: (url: string, body: object = {}) =>
        auth(request(app.getHttpServer()).post(url)).send(body),
    };
  }

  it('предусловие: число теряет id, строка — нет (иначе тест ничего не доказывает)', () => {
    expect(BigInt(Number(WEB))).not.toBe(WEB);
    expect(BigInt(Number(WEB))).toBe(BigInt(Number(NEIGHBOUR)));
  });

  describe('терапия', () => {
    beforeAll(async () => {
      const invite = await agentAs(THERAPIST).post('/api/therapy/invite');
      expect(invite.status).toBeLessThan(300);
      const join = await agentAs(WEB).post('/api/therapy/join', {
        code: invite.body.code,
      });
      expect(join.status).toBeLessThan(300);
    });

    it('GET /clients отдаёт id веб-клиента ТОЧНОЙ строкой', async () => {
      const res = await agentAs(THERAPIST).get('/api/therapy/clients');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].telegramId).toBe(WEB_STR);
    });

    it('терапевт идёт с этим id в путь: notes GET/POST, client-data — 200, clientId пишется точно', async () => {
      const t = agentAs(THERAPIST);
      const created = await t.post(`/api/therapy/notes/${WEB_STR}`, {
        date: '2026-10-01',
        text: 'веб-клиент: первая сессия',
      });
      expect(created.status).toBeLessThan(300);
      // clientId в ответе — точная строка, не округлённое число.
      expect(created.body.clientId).toBe(WEB_STR);

      const rows = await prisma.therapistNote.findMany({
        where: { therapistId: THERAPIST },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].clientId).toBe(WEB);

      const notes = await t.get(`/api/therapy/notes/${WEB_STR}`);
      expect(notes.status).toBe(200);
      expect(notes.body).toHaveLength(1);
      expect(notes.body[0].text).toBe('веб-клиент: первая сессия');

      const data = await t.get(`/api/therapy/client-data/${WEB_STR}`);
      expect(data.status).toBe(200);
    });

    it('соседний (округляющийся в тот же Number) id — не клиент: 403, а не чужая связь', async () => {
      const res = await agentAs(THERAPIST).get(
        `/api/therapy/notes/${NEIGHBOUR.toString()}`,
      );
      expect(res.status).toBe(403);
    });

    it('мусор вместо id → 400, id длиннее int64 → 400', async () => {
      const t = agentAs(THERAPIST);
      expect((await t.get('/api/therapy/notes/12abc')).status).toBe(400);
      expect(
        (await t.get('/api/therapy/notes/99999999999999999999')).status,
      ).toBe(400);
    });

    it('задача веб-клиенту: clientId строкой в теле → targetUserId точный, клиент видит задачу', async () => {
      const created = await agentAs(THERAPIST).post('/api/therapy/tasks', {
        type: 'custom',
        text: 'дневник схемы',
        clientId: WEB_STR,
      });
      expect(created.status).toBeLessThan(300);
      expect(created.body.userId).toBe(WEB_STR);
      expect(created.body.assignedBy).toBe(Number(THERAPIST));

      const mine = await agentAs(WEB).get('/api/therapy/tasks');
      expect(mine.status).toBe(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0].userId).toBe(WEB_STR);

      const forClient = await agentAs(THERAPIST).get(
        `/api/therapy/tasks/client/${WEB_STR}`,
      );
      expect(forClient.status).toBe(200);
      expect(forClient.body).toHaveLength(1);
    });

    it('GET /relation: у клиента partnerId — терапевт, у терапевта — веб-клиент точной строкой', async () => {
      const asTherapist = await agentAs(THERAPIST).get('/api/therapy/relation');
      expect(asTherapist.body.partnerId).toBe(WEB_STR);
      const asClient = await agentAs(WEB).get('/api/therapy/relation');
      expect(asClient.body.partnerId).toBe(Number(THERAPIST));
    });
  });

  describe('пары друзей', () => {
    it('GET /pair отдаёт точный id веб-партнёра (у друга) и друга (у веб-юзера)', async () => {
      const invite = await agentAs(FRIEND).post('/api/pair/invite');
      expect(invite.status).toBeLessThan(300);
      const join = await agentAs(WEB).post('/api/pair/join', {
        code: invite.body.code,
      });
      expect(join.status).toBeLessThan(300);

      const asFriend = await agentAs(FRIEND).get('/api/pair');
      expect(asFriend.status).toBe(200);
      expect(asFriend.body.partners).toHaveLength(1);
      expect(asFriend.body.partners[0].partnerTelegramId).toBe(WEB_STR);

      const asWeb = await agentAs(WEB).get('/api/pair');
      expect(asWeb.status).toBe(200);
      expect(asWeb.body.partners[0].partnerTelegramId).toBe(Number(FRIEND));
    });
  });
});
