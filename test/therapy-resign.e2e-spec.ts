// e2e: отказ терапевта от роли завершает его связи с клиентами (backend#33,
// глобальный аудит 2026-10-11). До правки resign менял только role/therapistMode:
// клиент продолжал видеть «Мой терапевт» и ссылку «Написать» на бывшего,
// терапевт не мог снять клиентов (кабинет закрыт, 403), а повторное одобрение
// роли мгновенно оживляло все связи без согласия клиентов.
//
// Гоняется дважды: на фейковой Prisma (джоба backend) и на живом Postgres
// (E2E_REAL_DB=1, джоба migrations): updateMany по `status IN (…)`, enum
// `ended` и вложенный фильтр по роли терапевта — то, что фейк уже расходился
// с базой.
//
// Действующие лица: терапевт T (отказывается), клиент C (только у T), клиент
// X (у T и у T2 — строка второго терапевта пишется в БД напрямую, через API её
// больше не создать, T3), терапевт T2 с клиентом D (контроль: его связь жива).
import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { TherapistRequestService } from '../src/therapy/therapist-request.service';

const ADMIN = 4_400_000_000_009n;
process.env.ADMIN_ID = ADMIN.toString();
const [T, T2, C, X, D, Z, K] = [1n, 2n, 3n, 4n, 5n, 6n, 7n].map(
  (n) => 4_400_000_000_000n + n,
);
const ALL = [T, T2, C, X, D, Z, K, ADMIN];
jest.setTimeout(60_000);

describe('e2e: отказ от роли терапевта завершает связи', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  let staleCode = '';
  const ENDED_ALL = [
    `${C}:ended`,
    `${X}:ended`,
    'null:ended',
    'null:ended',
  ].sort();

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
  const statuses = async (therapistId: bigint) =>
    (await prisma.therapyRelation.findMany({ where: { therapistId } }))
      .map((r: any) => `${r.clientId ?? 'null'}:${r.status}`)
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
    await connect(T2, D);
    await prisma.therapyRelation.create({
      data: {
        code: `LEGACY-${T2}-${X}`,
        therapistId: T2,
        clientId: X,
        status: 'active',
      },
    });
    // Офлайн-клиент и неиспользованное приглашение терапевта T.
    await act(T).post('/api/therapy/clients/virtual', { name: 'V' });
    staleCode = (await act(T).post('/api/therapy/invite')).body.code;
    // Данные терапевта (карта режимов) — их resign трогать не должен.
    const map = await act(T).post(`/api/therapy/mode-maps/${Number(C)}`, {
      title: 'карта',
    });
    expect(map.status).toBeLessThan(300);
  });

  afterAll(async () => {
    await prisma.therapistRequest.deleteMany({
      where: { userId: { in: ALL } },
    });
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it('до отказа: клиент C видит терапевта T', async () => {
    expect(await partnerOf(C)).toBe(Number(T));
  });

  it('DELETE therapist-role: роль CLIENT, все связи T (и приглашение) ended, чужие живы', async () => {
    const r = await act(T).del('/api/therapy/therapist-role');
    expect(r.status).toBe(200);
    const me = await prisma.user.findUnique({ where: { id: T } });
    expect(me.role).toBe('CLIENT');
    expect(await statuses(T)).toEqual(ENDED_ALL);
    // Контроль: связи другого терапевта не тронуты.
    expect(await statuses(T2)).toEqual([`${D}:active`, `${X}:active`].sort());
  });

  it('клиент C больше не видит «Мой терапевт»', async () => {
    expect((await act(C).get('/api/therapy/relation')).status).toBe(200);
    expect(await partnerOf(C)).toBeNull();
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

  it('старое приглашение бывшего терапевта больше не принимается', async () => {
    const join = await act(D).post('/api/therapy/join', { code: staleCode });
    expect(join.body).not.toEqual({ ok: true });
    expect(
      await prisma.therapyRelation.count({
        where: { code: staleCode, status: 'ended' },
      }),
    ).toBe(1);
  });

  it('повторная заявка + approve не воскрешает связи: клиентов нет, C отключён', async () => {
    await becomeTherapist(T);
    const clients = await act(T).get('/api/therapy/clients');
    expect(clients.status).toBe(200);
    expect(clients.body).toEqual([]);
    expect(await partnerOf(C)).toBeNull();
    expect(await statuses(T)).toEqual(ENDED_ALL);
  });

  it('новая связь — только через новое приглашение', async () => {
    await connect(T, C);
    expect(await partnerOf(C)).toBe(Number(T));
    const clients = await act(T).get('/api/therapy/clients');
    expect(clients.body.map((c: any) => c.telegramId)).toEqual([Number(C)]);
  });

  // Бэкфил для строк, осиротевших ДО появления статуса `ended`. SQL читается из
  // самой миграции (а не копируется в тест) и исполняется настоящей базой —
  // фейк SQL не исполняет (правило №18), поэтому только E2E_REAL_DB=1.
  const liveOnly = process.env.E2E_REAL_DB ? it : it.skip;
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
      // Сначала защита чтения: клиент K уже не видит Z, хотя строка active.
      expect(await partnerOf(K)).toBeNull();
      await prisma.$executeRawUnsafe(sql);
      expect(await statuses(Z)).toEqual([`${K}:ended`, 'null:ended'].sort());
      // Контроль: связи действующего терапевта T2 (role THERAPIST) не тронуты.
      expect(await statuses(T2)).toEqual([`${D}:active`, `${X}:active`].sort());
      // Идемпотентность: повторный прогон ничего не меняет.
      await prisma.$executeRawUnsafe(sql);
      expect(await statuses(Z)).toEqual([`${K}:ended`, 'null:ended'].sort());
    },
  );
});
