// e2e-смок ownership отметок «Про клиента» из «Справочника» (#1484): терапевт
// отмечает раздел своему клиенту; чужой терапевт и сам клиент отметок не видят
// и не меняют; копинг схемы сюда не пишется; удаление клиента и аккаунта
// стирает отметки, слияние аккаунтов их переносит (только живой Postgres:
// merge — сырой SQL).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { MergeService } from '../src/auth/merge.service';
import { AccountService } from '../src/bot/account.service';

const REAL_DB = process.env.E2E_REAL_DB === '1';
const itOnRealDb = REAL_DB ? it : it.skip;

describe('e2e smoke: отметки «Про клиента» — ownership', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const T1 = 4_000_000_000_000_071n;
  const T2 = 4_000_000_000_000_072n;
  const C1 = 4_000_000_000_000_073n;
  const C2 = 4_000_000_000_000_074n;
  const T3 = 4_000_000_000_000_075n; // второй аккаунт T1 — для слияния
  const ALL_USER_IDS = [T1, T2, C1, C2, T3];
  const ADDRESS = 'mode:vulnerable_child/experiential';
  const mark = { address: ADDRESS, snapshot: 'текст раздела', note: 'у неё' };

  function agentAs(userId: bigint) {
    const token = signAccessToken(userId, process.env.JWT_SECRET as string);
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const http = () => request(app.getHttpServer());
    return {
      get: (url: string) => auth(http().get(url)),
      put: (url: string, body: object = {}) => auth(http().put(url)).send(body),
      post: (url: string, body: object = {}) =>
        auth(http().post(url)).send(body),
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

  let markId: number;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    for (const id of [T1, T2, T3])
      await prisma.user.create({ data: { id, role: 'THERAPIST' } });
    for (const id of [C1, C2])
      await prisma.user.create({ data: { id, role: 'CLIENT' } });
    await connect(T1, C1);
    await connect(T2, C2);
    const res = await agentAs(T1).put(`/api/therapy/guide-marks/${C1}`, mark);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(true);
    markId = res.body.mark.id as number;
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await app.close();
  });

  it('терапевт видит отметку открытым текстом, в базе текст зашифрован', async () => {
    const res = await agentAs(T1).get(`/api/therapy/guide-marks/${C1}`);
    expect(res.status).toBe(200);
    expect(res.body.marks).toEqual([
      expect.objectContaining({ ...mark, id: markId, clientId: String(C1) }),
    ]);
    const row = await prisma.guideMark.findFirst({ where: { id: markId } });
    expect(row?.note).not.toBe(mark.note);
    expect(row?.snapshot).not.toBe(mark.snapshot);
    const by = await agentAs(T1).get(
      `/api/therapy/guide-marks?address=${encodeURIComponent(ADDRESS)}`,
    );
    expect(by.body).toEqual({ clientIds: [String(C1)] });
  });

  it('повтор того же адреса — правка, не дубль', async () => {
    const res = await agentAs(T1).put(`/api/therapy/guide-marks/${C1}`, {
      ...mark,
      note: 'уточнение',
    });
    expect(res.body).toMatchObject({
      created: false,
      mark: { id: markId, note: 'уточнение' },
    });
    expect(await prisma.guideMark.count({ where: { therapistId: T1 } })).toBe(
      1,
    );
  });

  it('выделенный фрагмент: несколько на адрес, повтор текста — правка, шифруется, чужому — 403', async () => {
    const put = (body: object) =>
      agentAs(T1).put(`/api/therapy/guide-marks/${C1}`, body);
    const frag = { address: ADDRESS, snapshot: 'кусок', fragment: true };
    const a = await put(frag);
    const again = await put({ ...frag, snapshot: ' кусок ', note: 'правка' });
    await put({ ...frag, snapshot: 'другой кусок' });
    expect(a.body.created).toBe(true);
    expect(again.body).toMatchObject({
      created: false,
      mark: { id: a.body.mark.id, note: 'правка' },
    });
    const list = await agentAs(T1).get(`/api/therapy/guide-marks/${C1}`);
    expect(
      list.body.marks.map((m: { fragment: boolean }) => m.fragment),
    ).toEqual([false, true, true]);
    const row = await prisma.guideMark.findFirst({
      where: { id: a.body.mark.id },
    });
    expect(row?.snapshot).not.toBe('кусок');
    expect((await put({ ...frag, snapshot: 'я'.repeat(3001) })).status).toBe(
      400,
    );
    expect(
      (await agentAs(T2).put(`/api/therapy/guide-marks/${C1}`, frag)).status,
    ).toBe(403);
    // «уже отмечено» — про раздел целиком, фрагменты его не подменяют
    await prisma.guideMark.deleteMany({
      where: { therapistId: T1, fragmentKey: { not: '' } },
    });
  });

  it('чужой терапевт не читает, не пишет и не снимает; «уже отмечено» — только своё', async () => {
    const t2 = agentAs(T2);
    expect((await t2.get(`/api/therapy/guide-marks/${C1}`)).status).toBe(403);
    expect((await t2.put(`/api/therapy/guide-marks/${C1}`, mark)).status).toBe(
      403,
    );
    expect(
      (await t2.delete(`/api/therapy/guide-marks/items/${markId}`)).status,
    ).toBe(404);
    const by = await t2.get(
      `/api/therapy/guide-marks?address=${encodeURIComponent(ADDRESS)}`,
    );
    expect(by.body).toEqual({ clientIds: [] });
    expect(await prisma.guideMark.count({ where: { id: markId } })).toBe(1);
  });

  it('клиент отметок не видит и не пишет', async () => {
    const c1 = agentAs(C1);
    expect((await c1.get(`/api/therapy/guide-marks/${C1}`)).status).toBe(403);
    expect((await c1.put(`/api/therapy/guide-marks/${C1}`, mark)).status).toBe(
      403,
    );
  });

  it('копинг схемы и тело вне DTO — 400', async () => {
    const t1 = agentAs(T1);
    const bad = [
      { ...mark, address: 'schema:subjugation/coping.surrender' },
      { ...mark, address: 'tab:safety/text' },
      { ...mark, snapshot: '' },
      { ...mark, note: 'x'.repeat(1001) },
    ];
    for (const body of bad)
      expect(
        (await t1.put(`/api/therapy/guide-marks/${C1}`, body)).status,
      ).toBe(400);
  });

  itOnRealDb('слияние аккаунтов терапевта переносит отметки', async () => {
    await prisma.guideMark.create({
      data: { therapistId: T3, clientId: C2, address: ADDRESS, snapshot: 's' },
    });
    await prisma.guideMark.create({
      data: {
        therapistId: T3,
        clientId: C2,
        address: ADDRESS,
        snapshot: 'f',
        fragmentKey: 'k1',
      },
    });
    await app.get(MergeService).merge(T3, T1);
    expect(
      await prisma.guideMark.count({
        where: { therapistId: T1, clientId: C2 },
      }),
    ).toBe(2);
    expect(await prisma.guideMark.count({ where: { therapistId: T3 } })).toBe(
      0,
    );
  });

  itOnRealDb('удаление аккаунта клиента стирает отметки о нём', async () => {
    await prisma.guideMark.create({
      data: { therapistId: T2, clientId: C2, address: ADDRESS, snapshot: 's' },
    });
    await app.get(AccountService).deleteAllUserData(C2);
    expect(await prisma.guideMark.count({ where: { clientId: C2 } })).toBe(0);
  });

  it('снятие у владельца; удаление клиента терапевтом стирает его отметки', async () => {
    const t1 = agentAs(T1);
    const del = await t1.delete(`/api/therapy/guide-marks/items/${markId}`);
    expect(del.body).toEqual({ ok: true });
    await t1.put(`/api/therapy/guide-marks/${C1}`, {
      ...mark,
      address: 'technique:chairwork/when',
    });
    const removed = await t1.delete(`/api/therapy/clients/${C1}`);
    expect(removed.status).toBeLessThan(300);
    expect(
      await prisma.guideMark.count({
        where: { therapistId: T1, clientId: C1 },
      }),
    ).toBe(0);
  });
});
