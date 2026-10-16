// Аудит 2026-10 («Слияние плодит дубли активных связей»): merge S→T только
// ремапил therapistId/clientId и userId1/userId2, и после него на живом Postgres
// было две TherapyRelation (TH,T,active) и две Pair (T,X,active) — клиент у
// терапевта и партнёр у друга показывались дважды. Инварианта «одна активная
// связь на пару» в базе не было, он жил в `findFirst → alreadyConnected`.
//
// Здесь — настоящая БД, настоящие MergeService / PairsService /
// TherapyRelationsService и миграция 20261016100000_active_relation_unique.
// Гоняется только на живом Postgres (E2E_REAL_DB=1, джоба `migrations`): merge —
// сырой SQL, а уникальность и ошибка 23505 — свойство Postgres; фейк Prisma
// частичный индекс не исполняет (правила №14 и №18).
import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { MergeService } from '../src/auth/merge.service';
import { PairsService } from '../src/bot/pairs.service';
import { TherapyRelationsService } from '../src/therapy/therapy-relations.service';
import { isUniqueViolation } from '../src/prisma/unique-violation';
import { PrismaService } from '../src/prisma/prisma.service';
import { claimTherapyInvite } from '../src/therapy/therapy-invite-claim';

const REAL_DB = process.env.E2E_REAL_DB === '1';
const describeOnRealDb = REAL_DB ? describe : describe.skip;

// S — сливаемый аккаунт (Telegram), T — основной (веб), TH — терапевт,
// X/Y/Z — третьи лица. Все ниже веб-диапазона, кроме T.
const [TH, S, X, Y, Z, TH2] = [1n, 2n, 3n, 4n, 5n, 6n].map(
  (n) => 770_002_000n + n,
);
const T = 1_000_000_000_000_902n;
const ALL = [TH, S, T, X, Y, Z, TH2];
jest.setTimeout(60_000);

describeOnRealDb(
  'e2e: активная связь терапевта и пары — не больше одной',
  () => {
    let app: INestApplication;
    let prisma: TestApp['prisma'];
    let code = 0;
    const nextCode = () => `MRG${String(++code).padStart(6, '0')}`;

    beforeAll(async () => {
      const built = await buildTestApp();
      app = built.app;
      prisma = built.prisma;
    });
    afterAll(async () => {
      await cleanupOwnershipFixtures(prisma, ALL);
      await app.close();
    });
    beforeEach(async () => {
      await cleanupOwnershipFixtures(prisma, ALL);
      for (const id of ALL) await prisma.user.create({ data: { id } });
      await prisma.authProvider.create({
        data: { userId: S, provider: 'telegram', providerId: String(S) },
      });
    });

    const rel = (
      therapistId: bigint,
      clientId: bigint | null,
      extra: Record<string, unknown> = {},
    ) =>
      prisma.therapyRelation.create({
        data: {
          code: nextCode(),
          therapistId,
          clientId,
          status: 'active',
          ...extra,
        },
      });
    const pair = (
      userId1: bigint,
      userId2: bigint | null,
      status: 'active' | 'pending' | 'ended' = 'active',
    ) =>
      prisma.pair.create({
        data: { code: nextCode(), userId1, userId2, status },
      });
    const activeRels = (therapistId: bigint, clientId: bigint) =>
      prisma.therapyRelation.count({
        where: { therapistId, clientId, status: 'active' },
      });
    const clientsOf = async (therapistId: bigint) =>
      (await app.get(TherapyRelationsService).getClients(therapistId)).map(
        (c) => String(c.telegramId),
      );
    const partnersOf = async (userId: bigint) =>
      (await app.get(PairsService).getUserPairs(userId))
        .filter((p) => p.status === 'active')
        .map((p) => String(p.partnerId));

    describe('слияние S → T', () => {
      beforeEach(async () => {
        // Клиентская сторона: TH ведёт и S (с именем и датой), и T (без).
        await rel(TH, S, {
          clientAlias: 'Алиса',
          therapyStartDate: '2026-01-05',
          nextSession: '2026-11-01',
          meetingDays: [1, 4],
        });
        await rel(TH, T, { nextSession: '2026-12-01' });
        // Терапевтская сторона: и S, и T ведут клиента Y; у S есть ещё Z.
        await rel(S, Y, { clientAlias: 'Из S', meetingDays: [2] });
        await rel(T, Y, { meetingDays: [5] });
        await rel(S, Z);
        // Офлайн-клиенты не дубли друг друга (clientId NULL).
        await rel(S, null, { virtualClientName: 'Офлайн S' });
        await rel(T, null, { virtualClientName: 'Офлайн T' });
        // Пары: S–X и X–T в обратной ориентации, S–Z без конфликта.
        await pair(S, X);
        await pair(X, T);
        await pair(S, Z);
      });

      it('клиент терапевта виден один раз, данные source доливаются, чужое и офлайн-клиенты живы', async () => {
        await app.get(MergeService).merge(S, T);

        const ofTh = await clientsOf(TH);
        expect(ofTh.filter((id) => id === String(T))).toHaveLength(1);
        const row = await prisma.therapyRelation.findFirstOrThrow({
          where: { therapistId: TH, clientId: T, status: 'active' },
        });
        expect(row.clientAlias).toBe('Алиса'); // у target пусто → из source
        expect(row.therapyStartDate).toBe('2026-01-05');
        expect(row.nextSession).toBe('2026-12-01'); // у target занято → target wins
        // meetingDays NOT NULL, «пусто» у target — это [] по дефолту.
        expect(row.meetingDays).toEqual([1, 4]);

        const ofT = await clientsOf(T);
        expect(ofT.filter((id) => id === String(Y))).toHaveLength(1);
        expect(ofT).toContain(String(Z)); // без конфликта — переехал
        expect(await activeRels(T, Y)).toBe(1);
        const virtual = await prisma.therapyRelation.findMany({
          where: { therapistId: T, clientId: null, status: 'active' },
        });
        expect(virtual.map((v) => v.virtualClientName).sort()).toEqual([
          'Офлайн S',
          'Офлайн T',
        ]);
        const alias = await prisma.therapyRelation.findFirstOrThrow({
          where: { therapistId: T, clientId: Y },
        });
        expect(alias.clientAlias).toBe('Из S');
        expect(alias.meetingDays).toEqual([5]); // у target заданы → target wins
        expect(
          await prisma.therapyRelation.count({
            where: { OR: [{ therapistId: S }, { clientId: S }] },
          }),
        ).toBe(0);
      });

      it('партнёр виден один раз в любой ориентации, пара без конфликта переехала', async () => {
        await app.get(MergeService).merge(S, T);

        expect(
          (await partnersOf(X)).filter((id) => id === String(T)),
        ).toHaveLength(1);
        expect((await partnersOf(T)).sort()).toEqual([String(X), String(Z)]);
        expect(
          await prisma.pair.count({
            where: { OR: [{ userId1: S }, { userId2: S }] },
          }),
        ).toBe(0);
      });

      it('pending- и ended-строки source переезжают, не мешая активной', async () => {
        await prisma.therapyRelation.create({
          data: {
            code: nextCode(),
            therapistId: TH,
            clientId: S,
            status: 'ended',
          },
        });
        await pair(S, null, 'pending');
        await app.get(MergeService).merge(S, T);

        expect(await activeRels(TH, T)).toBe(1);
        expect(
          await prisma.therapyRelation.count({
            where: { therapistId: TH, clientId: T, status: 'ended' },
          }),
        ).toBe(1);
        expect(
          await prisma.pair.count({ where: { userId1: T, status: 'pending' } }),
        ).toBe(1);
      });
    });

    describe('индексы не шире, чем нужно', () => {
      const rejectsAsDuplicate = async (p: Promise<unknown>) => {
        const err = await p.then(
          () => null,
          (e: unknown) => e,
        );
        expect(err).not.toBeNull();
        expect(isUniqueViolation(err)).toBe(true);
      };

      it('вторая активная связь тех же двоих и вторая активная пара (в любой ориентации) — 23505', async () => {
        await rel(TH, X);
        await rejectsAsDuplicate(rel(TH, X));
        await pair(S, X);
        await rejectsAsDuplicate(pair(S, X));
        await rejectsAsDuplicate(pair(X, S));
      });

      it('контроль: ended/pending, офлайн-клиенты, другой терапевт и другой партнёр проходят', async () => {
        await rel(TH, X);
        await rel(TH, X, { status: 'ended' });
        await rel(TH, X, { status: 'pending' });
        await rel(TH, null, { virtualClientName: 'A' });
        await rel(TH, null, { virtualClientName: 'B' });
        await rel(TH2, X); // у клиента два терапевта — индекс по одному clientId не ставили
        await pair(S, X);
        await pair(S, X, 'ended');
        await pair(S, null, 'pending');
        await pair(S, null, 'pending');
        await pair(S, Y);
        await pair(Y, X);
        expect(await activeRels(TH, X)).toBe(1);
      });

      it('updateMany, активирующий вторую связь, даёт ошибку, которую узнаёт isUniqueViolation', async () => {
        await rel(TH, X);
        const pending = await rel(TH, null, { status: 'pending' });
        await rejectsAsDuplicate(
          prisma.therapyRelation.updateMany({
            where: { id: pending.id },
            data: { clientId: X, status: 'active' },
          }),
        );
      });
    });

    describe('приглашения не плодят дубль', () => {
      it('B вступил по коду A, затем A вступает по коду B → одна активная пара, обоим успех', async () => {
        const pairs = app.get(PairsService);
        const codeA = await pairs.createPairInvite(S);
        expect(await pairs.joinPair(X, codeA)).toBe(true);
        const codeB = await pairs.createPairInvite(X);

        expect(await pairs.joinPair(S, codeB)).toBe(true);

        const active = await prisma.pair.findMany({
          where: { status: 'active' },
        });
        expect(
          active.filter((p) => [p.userId1, p.userId2].includes(S)),
        ).toHaveLength(1);
        expect(await partnersOf(S)).toEqual([String(X)]);
        expect(await partnersOf(X)).toEqual([String(S)]);
      });

      it('два кода одного терапевта, применённые одним клиентом одновременно → одна активная связь, обоим true', async () => {
        const svc = app.get(TherapyRelationsService);
        const a = await rel(TH, null, { status: 'pending' });
        const b = await rel(TH, null, { status: 'pending' });

        const res = await Promise.all([
          svc.joinAsClient(X, a.code),
          svc.joinAsClient(X, b.code),
        ]);

        expect(res).toEqual([true, true]);
        expect(await activeRels(TH, X)).toBe(1);
        expect(await clientsOf(TH)).toEqual([String(X)]);
      });

      // Promise.all выше гонку не гарантирует: второй findFirst часто уже видит
      // первую активацию и отвечает «уже подключён» до UPDATE. Ниже ветка
      // проигравшего детерминирована — UPDATE идёт в частичный индекс мимо
      // предварительной проверки, и ошибку настоящего драйвера разбирает catch.
      it('проигравший гонку за код терапевта: 23505 от настоящего драйвера → true, второй код остаётся pending', async () => {
        const a = await rel(TH, null, { status: 'pending' });
        const b = await rel(TH, null, { status: 'pending' });
        expect(
          await app.get(TherapyRelationsService).joinAsClient(X, a.code),
        ).toBe(true);

        expect(
          await claimTherapyInvite(app.get(PrismaService), b.code, X),
        ).toBe(true);

        expect(await activeRels(TH, X)).toBe(1);
        const left = await prisma.therapyRelation.findUniqueOrThrow({
          where: { id: b.id },
        });
        expect(left.status).toBe('pending');
      });

      it('проигравший гонку встречных кодов пары: 23505 от настоящего драйвера → true, одна активная пара', async () => {
        const pairs = app.get(PairsService);
        const codeA = await pairs.createPairInvite(S);
        expect(await pairs.joinPair(X, codeA)).toBe(true);
        const codeB = await pairs.createPairInvite(X);
        // Встречный joinPair уже прошёл проверку «уже в паре» — её ответ «нет».
        const db = app.get(PrismaService);
        const spy = jest
          .spyOn(db.pair, 'findFirst')
          .mockResolvedValueOnce(null);

        try {
          expect(await pairs.joinPair(S, codeB)).toBe(true);
          expect(spy).toHaveBeenCalledTimes(1);
        } finally {
          spy.mockRestore();
        }

        expect(await partnersOf(S)).toEqual([String(X)]);
        expect(await partnersOf(X)).toEqual([String(S)]);
      });
    });

    describe('дедуп миграции на засеянных дублях', () => {
      const migration = readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261016100000_active_relation_unique/migration.sql',
        ),
        'utf8',
      );
      const statements = migration
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      const ROLLBACK = new Error('rollback');

      it('лишние активные связи завершаются, их имя/даты/дни доливаются в остающуюся, лишние пары удаляются; офлайн-клиенты и pending целы', async () => {
        let seen: Record<string, unknown> = {};
        await prisma
          .$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              'DROP INDEX "TherapyRelation_active_pair_key"',
            );
            await tx.$executeRawUnsafe('DROP INDEX "Pair_active_users_key"');
            const mk = (
              therapistId: bigint,
              clientId: bigint | null,
              status = 'active',
              extra: Record<string, unknown> = {},
            ) =>
              tx.therapyRelation.create({
                data: {
                  code: nextCode(),
                  therapistId,
                  clientId,
                  status: status as 'active',
                  ...extra,
                },
              });
            // Остающаяся строка (min id) без имени и дней встреч: их данные
            // лежат в дублях и обязаны доехать до неё, а не уйти в ended.
            const first = await mk(TH, X, 'active', {
              nextSession: '2026-12-01',
            });
            const dup = await mk(TH, X, 'active', {
              clientAlias: 'Из дубля',
              therapyStartDate: '2026-01-05',
              meetingDays: [2],
            });
            const dup2 = await mk(TH, X, 'active', {
              clientAlias: 'Второй дубль',
              nextSession: '2026-11-01',
              meetingDays: [3],
            });
            await mk(TH, X, 'pending');
            await mk(TH, null);
            await mk(TH, null);
            const mkPair = (
              userId1: bigint,
              userId2: bigint | null,
              status = 'active',
            ) =>
              tx.pair.create({
                data: {
                  code: nextCode(),
                  userId1,
                  userId2,
                  status: status as 'active',
                },
              });
            const p1 = await mkPair(S, X);
            const p2 = await mkPair(X, S);
            await mkPair(S, Y);
            await mkPair(S, null, 'pending');
            await mkPair(S, null, 'pending');

            for (const sql of statements) await tx.$executeRawUnsafe(sql);

            const statusOf = async (id: number) =>
              (await tx.therapyRelation.findUniqueOrThrow({ where: { id } }))
                .status;
            const snapshot = async () => ({
              first: await statusOf(first.id),
              kept: await tx.therapyRelation
                .findUniqueOrThrow({ where: { id: first.id } })
                .then((r) => ({
                  alias: r.clientAlias,
                  start: r.therapyStartDate,
                  next: r.nextSession,
                  days: r.meetingDays,
                })),
              dup: await statusOf(dup.id),
              dup2: await statusOf(dup2.id),
              activeX: await tx.therapyRelation.count({
                where: { therapistId: TH, clientId: X, status: 'active' },
              }),
              virtual: await tx.therapyRelation.count({
                where: { therapistId: TH, clientId: null, status: 'active' },
              }),
              pending: await tx.therapyRelation.count({
                where: { therapistId: TH, clientId: X, status: 'pending' },
              }),
              p1: await tx.pair.count({ where: { id: p1.id } }),
              p2: await tx.pair.count({ where: { id: p2.id } }),
              pairsSY: await tx.pair.count({
                where: { userId1: S, userId2: Y },
              }),
              pendingPairs: await tx.pair.count({
                where: { userId1: S, status: 'pending' },
              }),
            });
            seen = await snapshot();
            // Идемпотентность: второй прогон не падает и ничего не меняет.
            for (const sql of statements) await tx.$executeRawUnsafe(sql);
            expect(await snapshot()).toEqual(seen);
            throw ROLLBACK;
          })
          .catch((e: unknown) => {
            if (e !== ROLLBACK) throw e;
          });

        expect(seen).toEqual({
          first: 'active',
          // Непустое своё побеждает, пустое — из самого раннего дубля.
          kept: {
            alias: 'Из дубля',
            start: '2026-01-05',
            next: '2026-12-01',
            days: [2],
          },
          dup: 'ended',
          dup2: 'ended',
          activeX: 1,
          virtual: 2,
          pending: 1,
          p1: 1,
          p2: 0,
          pairsSY: 1,
          pendingPairs: 2,
        });
      });

      it('после отката индексы на месте (дедуп-тест ничего не оставил)', async () => {
        const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname FROM pg_indexes
        WHERE indexname IN ('TherapyRelation_active_pair_key', 'Pair_active_users_key')
        ORDER BY indexname`;
        expect(rows.map((r) => r.indexname)).toEqual([
          'Pair_active_users_key',
          'TherapyRelation_active_pair_key',
        ]);
      });
    });
  },
);
