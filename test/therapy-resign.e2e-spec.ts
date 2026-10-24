// e2e: отказ терапевта от роли завершает его связи с клиентами (backend#33,
// глобальный аудит 2026-10-11). До правки resign менял только role/therapistMode:
// клиент продолжал видеть «Мой терапевт» и ссылку «Написать» на бывшего,
// терапевт не мог снять клиентов (кабинет закрыт, 403), а повторное одобрение
// роли мгновенно оживляло все связи без согласия клиентов.
//
// Гоняется дважды: на фейковой Prisma (джоба backend) и на живом Postgres
// (E2E_REAL_DB=1, джоба migrations): updateMany по `status IN (…)` с OR по
// офлайн-клиенту и enum `ended` — то, где фейк уже расходился с базой. Проверка
// роли терапевта у клиента живёт в коде (getRelationInfo), не во вложенном where.
//
// Офлайн-клиенты (virtualClientName) при отказе от роли НЕ завершаются: у них
// нет стороны клиента, а Step D слияния аккаунтов удаляет концептуализации
// виртуальных клиентов без active-связи.
//
// После отказа клиент видит сообщение о бывшем терапевте (GET
// /api/therapy/former-therapist), а карты режимов и задания терапевта остаются
// у него как история (решение владельца 2026-10-22).
//
// Действующие лица: терапевт T (отказывается), клиент C (только у T), клиент
// X (у T и у T2 — строка второго терапевта пишется в БД напрямую, через API её
// больше не создать, T3), терапевт T2 с клиентом D (контроль: его связь жива),
// клиент Y (у T, после отказа подключается к T2 по приглашению).
import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { MergeService } from '../src/auth/merge.service';
import { TherapistRequestService } from '../src/therapy/therapist-request.service';

const ADMIN = 4_400_000_000_009n;
process.env.ADMIN_ID = ADMIN.toString();
const [T, T2, C, X, D, Z, K, Y] = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n].map(
  (n) => 4_400_000_000_000n + n,
);
const ALL = [T, T2, C, X, D, Z, K, Y, ADMIN];
jest.setTimeout(60_000);

describe('e2e: отказ от роли терапевта завершает связи', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  let staleCode = '';
  // C, X, Y — ended; приглашение (null:ended) — ended; офлайн-клиент V (null:active) жив.
  const AFTER_RESIGN = [
    `${C}:ended`,
    `${X}:ended`,
    `${Y}:ended`,
    'null:ended',
    'null:active',
  ].sort();
  const virtualId = async () =>
    (await prisma.therapyRelation.findMany({ where: { therapistId: T } })).find(
      (r) => r.virtualClientName,
    )!.id;

  const liveOnly = process.env.E2E_REAL_DB ? it : it.skip;

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
  const connect = async (t: bigint, client: bigint) => {
    const inv = await act(t).post('/api/therapy/invite');
    const join = await act(client).post('/api/therapy/join', {
      code: inv.body.code,
    });
    expect(join.body).toEqual({ ok: true });
  };
  const becomeTherapist = async (userId: bigint) => {
    const req = await act(userId).post('/api/therapy/request', {
      fullName: 'Тест Терапевтов',
      qualification: 'МИСТ',
      contacts: '@t',
    });
    expect(req.status).toBeLessThan(300);
    // Как делает Telegram-колбэк админа.
    await app.get(TherapistRequestService).approve(Number(ADMIN), req.body.id);
  };
  // GET relation без связи отдаёт null (пустое тело) — partnerId тогда undefined.
  const partnerOf = async (who: bigint) =>
    (await act(who).get('/api/therapy/relation')).body.partnerId ?? null;
  // null сервер отдаёт пустым телом — тогда body = {}.
  const formerOf = async (who: bigint) => {
    const r = await act(who).get('/api/therapy/former-therapist');
    expect(r.status).toBe(200);
    return r.body?.name === undefined ? null : r.body;
  };
  const statuses = async (therapistId: bigint) =>
    (await prisma.therapyRelation.findMany({ where: { therapistId } }))
      .map((r) => `${r.clientId ?? 'null'}:${r.status}`)
      .sort();

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await prisma.therapistRequest.deleteMany({
      where: { userId: { in: ALL } },
    });
    for (const id of ALL)
      await prisma.user.create({ data: { id, firstName: `u${id}` } });
    await becomeTherapist(T);
    await becomeTherapist(T2);
    await connect(T, C);
    await connect(T, X);
    await connect(T, Y);
    await connect(T2, D);
    await prisma.therapyRelation.create({
      data: {
        code: `LEGACY-${T2}-${X}`,
        therapistId: T2,
        clientId: X,
        status: 'active',
      },
    });
    // Офлайн-клиент (с концептуализацией) и неиспользованное приглашение T.
    await act(T).post('/api/therapy/clients/virtual', { name: 'V' });
    await prisma.clientConceptualization.create({
      data: { therapistId: T, clientId: BigInt(-(await virtualId())) },
    });
    staleCode = (await act(T).post('/api/therapy/invite')).body.code;
    // Данные терапевта (карта режимов) — их resign трогать не должен.
    const map = await act(T).post(`/api/therapy/mode-maps/${Number(C)}`, {
      title: 'карта',
    });
    expect(map.status).toBeLessThan(300);
    const task = await act(T).post('/api/therapy/tasks', {
      type: 'custom',
      text: 'задание терапевта',
      clientId: String(C),
    });
    expect(task.status).toBeLessThan(300);
  });

  afterAll(async () => {
    await prisma.therapistRequest.deleteMany({
      where: { userId: { in: ALL } },
    });
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('до отказа: клиент C видит терапевта T, сообщения о бывшем нет', async () => {
    expect(await partnerOf(C)).toBe(Number(T));
    expect(await formerOf(C)).toBeNull();
  });

  it('DELETE therapist-role: роль CLIENT, связи T с клиентами и приглашение ended, офлайн-клиент и чужие живы', async () => {
    const r = await act(T).del('/api/therapy/therapist-role');
    expect(r.status).toBe(200);
    const me = await prisma.user.findUnique({ where: { id: T } });
    expect(me.role).toBe('CLIENT');
    expect(await statuses(T)).toEqual(AFTER_RESIGN);
    // Контроль: связи другого терапевта не тронуты.
    expect(await statuses(T2)).toEqual([`${D}:active`, `${X}:active`].sort());
  });

  it('клиент C больше не видит «Мой терапевт»', async () => {
    expect((await act(C).get('/api/therapy/relation')).status).toBe(200);
    expect(await partnerOf(C)).toBeNull();
  });

  it('вместо него — сообщение: имя бывшего терапевта и дата окончания', async () => {
    const former = await formerOf(C);
    expect(former).toEqual({ name: `u${T}`, endedAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(former.endedAt))).toBe(false);
  });

  it('событие therapist_resigned: число завершённых связей с клиентами (C, X, Y)', async () => {
    const events = await prisma.analyticsEvent.findMany({
      where: { userId: T, name: 'therapist_resigned' },
    });
    expect(events.map((e: { meta: unknown }) => e.meta)).toEqual([
      { clientsEnded: 3 },
    ]);
  });

  it('карты режимов и задания бывшего терапевта остаются у клиента как история', async () => {
    const maps = await act(C).get('/api/therapy/my-mode-maps');
    expect(maps.status).toBe(200);
    expect(maps.body.map((m: { title: string }) => m.title)).toEqual(['карта']);
    const tasks = await act(C).get('/api/therapy/tasks');
    expect(tasks.status).toBe(200);
    expect(
      tasks.body.map((t: { text: string; assignedBy: number }) => [
        t.text,
        t.assignedBy,
      ]),
    ).toEqual([['задание терапевта', Number(T)]]);
  });

  it('у клиента другого терапевта (не отказывался) сообщения нет', async () => {
    expect(await formerOf(D)).toBeNull();
    // X подключён ко второму терапевту — «Мой терапевт» на месте, сообщения нет.
    expect(await formerOf(X)).toBeNull();
  });

  it('клиент подключился к новому терапевту по приглашению — сообщение уходит', async () => {
    expect((await formerOf(Y))?.name).toBe(`u${T}`);
    await connect(T2, Y);
    expect(await partnerOf(Y)).toBe(Number(T2));
    expect(await formerOf(Y)).toBeNull();
  });

  it('клиент X видит только второго терапевта T2', async () => {
    expect(await partnerOf(X)).toBe(Number(T2));
  });

  it('контроль: клиент D второго терапевта по-прежнему подключён к T2', async () => {
    expect(await partnerOf(D)).toBe(Number(T2));
  });

  it('данные терапевта не удалены: карта режимов на месте', async () => {
    expect(
      await prisma.modeMap.count({ where: { therapistId: T, clientId: C } }),
    ).toBe(1);
  });

  // Слияние аккаунтов — сырой SQL (Step D), фейк его не исполнит (правило №18).
  // Регрессия ревью: Step D удаляет концептуализации виртуальных клиентов без
  // active-связи, поэтому resign не должен завершать офлайн-клиентов.
  liveOnly(
    'слияние аккаунтов бывшего терапевта не стирает концептуализацию офлайн-клиента',
    async () => {
      const MERGED = 4_400_000_000_100n;
      const where = {
        therapistId: T,
        clientId: BigInt(-(await virtualId())),
      };
      expect(await prisma.clientConceptualization.count({ where })).toBe(1);
      await prisma.user.create({ data: { id: MERGED } });
      // T — цель слияния: Step D чистит строки именно цели.
      await app.get(MergeService).merge(MERGED, T);
      expect(await prisma.clientConceptualization.count({ where })).toBe(1);
      await cleanupOwnershipFixtures(prisma, [MERGED]);
    },
  );

  it('старое приглашение бывшего терапевта больше не принимается', async () => {
    const join = await act(D).post('/api/therapy/join', { code: staleCode });
    expect(join.body).not.toEqual({ ok: true });
    expect(
      await prisma.therapyRelation.count({
        where: { code: staleCode, status: 'ended' },
      }),
    ).toBe(1);
  });

  it('повторная заявка + approve не воскрешает связи с клиентами: C отключён, офлайн-клиент на месте', async () => {
    await becomeTherapist(T);
    const clients = await act(T).get('/api/therapy/clients');
    expect(clients.status).toBe(200);
    expect(clients.body).toHaveLength(1);
    expect(clients.body[0]).toMatchObject({ name: expect.any(String) });
    expect(await partnerOf(C)).toBeNull();
    expect(await statuses(T)).toEqual(AFTER_RESIGN);
  });

  it('новая связь — только через новое приглашение', async () => {
    await connect(T, C);
    expect(await partnerOf(C)).toBe(Number(T));
    expect(await formerOf(C)).toBeNull();
    const clients = await act(T).get('/api/therapy/clients');
    expect(
      clients.body.map((c: { telegramId: number | null }) => c.telegramId),
    ).toContain(Number(C));
  });

  // Бэкфил для строк, осиротевших ДО появления статуса `ended`. SQL читается из
  // самой миграции (а не копируется в тест) и исполняется настоящей базой —
  // фейк SQL не исполняет (правило №18), поэтому только E2E_REAL_DB=1.
  liveOnly(
    'миграция-бэкфил завершает связи не-терапевтов и не трогает живые',
    async () => {
      const sql = readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261014090100_relation_ended_backfill/migration.sql',
        ),
        'utf8',
      );
      // Z — бывший терапевт (role CLIENT) со старой active-связью и приглашением.
      await prisma.therapyRelation.create({
        data: {
          code: 'ORPHAN-A',
          therapistId: Z,
          clientId: K,
          status: 'active',
        },
      });
      await prisma.therapyRelation.create({
        data: { code: 'ORPHAN-P', therapistId: Z, status: 'pending' },
      });
      // Офлайн-клиент бывшего терапевта бэкфилом не затрагивается.
      await prisma.therapyRelation.create({
        data: {
          code: 'ORPHAN-V',
          therapistId: Z,
          status: 'active',
          virtualClientName: 'V',
        },
      });
      // Сначала защита чтения: клиент K уже не видит Z, хотя строка active.
      expect(await partnerOf(K)).toBeNull();
      await prisma.$executeRawUnsafe(sql);
      expect(await statuses(Z)).toEqual(
        [`${K}:ended`, 'null:ended', 'null:active'].sort(),
      );
      // Контроль: связи действующего терапевта T2 (role THERAPIST) не тронуты.
      expect(await statuses(T2)).toEqual(
        [`${D}:active`, `${X}:active`, `${Y}:active`].sort(),
      );
      // Идемпотентность: повторный прогон ничего не меняет.
      await prisma.$executeRawUnsafe(sql);
      expect(await statuses(Z)).toEqual(
        [`${K}:ended`, 'null:ended', 'null:active'].sort(),
      );
    },
  );

  // Бэкфил причины окончания (20261022150000): связи, завершённые до колонки
  // endReason, получают therapist_resigned, только если терапевт сейчас не
  // THERAPIST. Дубль пары действующего терапевта (дедуп 20261016100000 тоже
  // ставил `ended`) не превращается в «терапевт больше не работает». Идёт
  // после бэкфила статусов выше: связи Z уже `ended`, причины у них нет.
  liveOnly(
    'миграция-бэкфил причины: отказ от роли — да, дубль действующего терапевта — нет',
    async () => {
      const sql = readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261022150000_therapy_relation_end/migration.sql',
        ),
        'utf8',
      );
      await prisma.therapyRelation.create({
        data: {
          code: `DUP-${T2}-${D}`,
          therapistId: T2,
          clientId: D,
          status: 'ended',
        },
      });
      const reasons = async (therapistId: bigint) =>
        (
          await prisma.therapyRelation.findMany({
            where: { therapistId, status: 'ended' },
          })
        ).map((r: { endReason: string | null }) => r.endReason);
      expect(await formerOf(K)).toBeNull();
      await prisma.$executeRawUnsafe(sql);
      expect(await reasons(Z)).toEqual([
        'therapist_resigned',
        'therapist_resigned',
      ]);
      expect(await reasons(T2)).toEqual([null]);
      // Клиент K бывшего терапевта Z теперь видит сообщение (даты нет).
      expect(await formerOf(K)).toEqual({ name: `u${Z}`, endedAt: null });
      // Повторный прогон ничего не меняет.
      await prisma.$executeRawUnsafe(sql);
      expect(await reasons(T2)).toEqual([null]);
    },
  );
});
