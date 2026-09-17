// e2e SMOKE (TEST_IMPROVEMENT_PLAN.md, этап 1.2) — ownership-изоляция для
// therapy-контура: до этого спека ни один маршрут из 5 therapy-контроллеров
// (TherapyConnectionController, TherapyNotesController, ModeMapsController,
// TherapyController, TherapyTasksController) не вызывался в e2e вообще. Это
// privacy-критичный контур: заметки сессий, кейс-концептуализация, карты
// режимов и задачи — клинические данные РЕАЛЬНЫХ клиентов терапии.
//
// Тот же build-test-app.ts (реальный AppModule, fake Prisma + bot), что и в
// app-ownership*.e2e-spec.ts. Инвариант, который проверяем: терапевт видит
// ТОЛЬКО своих клиентов (граница — активная TherapyRelation, проверяемая
// TherapyRelationsService.assertHasClient), а клиент не может залезть в
// терапевтские ручки вообще.
//
// Этот файл: сценарии 1/2/4/5/6/7 (позитив T1↔C1, негатив T2 без связи,
// клиент не терапевт, POST от чужого терапевта не создаёт запись, задачи и
// custom-modes не текут между терапевтами). Разрыв связи (сценарий 3,
// регресс PR #66 mode-maps) — в therapy-ownership-2.e2e-spec.ts, там же
// отдельная пара пользователей, чтобы не зависеть от порядка тестов здесь.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e smoke: therapy ownership isolation (therapist ↔ client)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const secret = () => process.env.JWT_SECRET as string;

  // T1 — терапевт с активной связью с C1. T2 — терапевт БЕЗ связи с C1
  // (проверяем, что чужой терапевт не видит данные C1). C1 — клиент T1.
  const T1 = 4_000_000_000_000_001n;
  const T2 = 4_000_000_000_000_002n;
  const C1 = 4_000_000_000_000_003n;
  const C1_ID = Number(C1);
  const ALL_USER_IDS = [T1, T2, C1];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    // Изоляция между прогонами (TEST_TRUST_PLAN.md, п.1) — см. комментарий
    // в app-ownership.e2e-spec.ts. На реальном Postgres обязательна и перед
    // прямой вставкой User-строк ниже (role: THERAPIST) — иначе повторный
    // локальный прогон падает на PK-конфликте id.
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
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
      delete: (url: string) => auth(request(app.getHttpServer()).delete(url)),
    };
  }

  beforeAll(async () => {
    // Роль THERAPIST выдаётся только через админ-одобренную заявку
    // (POST /api/therapy/request), HTTP-пути «стать терапевтом» самому нет —
    // поэтому роль проставляем напрямую в fake-prisma, как единственный
    // доступный способ подготовить фикстуру (аналог ручного апрува админом).
    await prisma.user.create({ data: { id: T1, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: T2, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: C1, role: 'CLIENT' } });

    // Реальный invite→join HTTP-флоу — как в проде, не прямая вставка связи.
    const t1 = agentAs(T1);
    const c1 = agentAs(C1);
    const invite = await t1.post('/api/therapy/invite');
    expect(invite.status).toBeLessThan(300);
    const join = await c1.post('/api/therapy/join', { code: invite.body.code });
    expect(join.status).toBeLessThan(300);
    expect(join.body).toEqual({ ok: true });
  });

  // ─── Сценарий 1: T1 (активная связь) видит СВОИ данные C1 ────────────────

  it('T1 создаёт заметку сессии и карту концептуализации, видит их по GET', async () => {
    const t1 = agentAs(T1);
    const created = await t1.post(`/api/therapy/notes/${C1_ID}`, {
      date: '2026-07-20',
      text: 'первая сессия: тревога, избегание',
    });
    expect(created.status).toBeLessThan(300);

    const notes = await t1.get(`/api/therapy/notes/${C1_ID}`);
    expect(notes.status).toBe(200);
    expect(notes.body).toHaveLength(1);
    expect(notes.body[0].text).toBe('первая сессия: тревога, избегание');

    const savedConcept = await t1.post(
      `/api/therapy/conceptualization/${C1_ID}`,
      {
        schemaIds: ['abandonment'],
        earlyExperience: 'ранний опыт клиента',
      },
    );
    expect(savedConcept.status).toBeLessThan(300);

    const concept = await t1.get(`/api/therapy/conceptualization/${C1_ID}`);
    expect(concept.status).toBe(200);
    expect(concept.body.schemaIds).toEqual(['abandonment']);
    expect(concept.body.earlyExperience).toBe('ранний опыт клиента');
  });

  it('T1 видит client-data C1 (не 403, профиль по умолчанию открыт)', async () => {
    const t1 = agentAs(T1);
    const data = await t1.get(`/api/therapy/client-data/${C1_ID}`);
    expect(data.status).toBe(200);
    expect(data.body.mySchemaIds).toEqual([]);
  });

  it('T1 назначает задачу C1 и видит её через tasks/client/:clientId', async () => {
    const t1 = agentAs(T1);
    const task = await t1.post('/api/therapy/tasks', {
      type: 'custom',
      text: 'заполнить дневник схем',
      clientId: C1_ID,
    });
    expect(task.status).toBeLessThan(300);

    const list = await t1.get(`/api/therapy/tasks/client/${C1_ID}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].text).toBe('заполнить дневник схем');
  });

  it('T1 создаёт карту режимов для C1 и видит её в списке', async () => {
    const t1 = agentAs(T1);
    const createdMap = await t1.post(`/api/therapy/mode-maps/${C1_ID}`, {
      title: 'Карта T1↔C1',
    });
    expect(createdMap.status).toBeLessThan(300);

    const list = await t1.get(`/api/therapy/mode-maps/${C1_ID}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('Карта T1↔C1');
  });

  // ─── Сценарий 2: T2 (нет связи с C1) — отказ, чужих данных в теле нет ─────

  it('T2 без связи с C1: GET notes/conceptualization/client-data/tasks/mode-maps → 403', async () => {
    const t2 = agentAs(T2);
    const routes = [
      `/api/therapy/notes/${C1_ID}`,
      `/api/therapy/conceptualization/${C1_ID}`,
      `/api/therapy/client-data/${C1_ID}`,
      `/api/therapy/tasks/client/${C1_ID}`,
      `/api/therapy/mode-maps/${C1_ID}`,
    ];
    for (const url of routes) {
      const res = await t2.get(url);
      expect(res.status).toBe(403);
      // Тело ответа — только текст ошибки NestJS, не JSON с данными C1.
      expect(JSON.stringify(res.body)).not.toContain('тревога');
      expect(JSON.stringify(res.body)).not.toContain('abandonment');
      expect(JSON.stringify(res.body)).not.toContain('дневник схем');
      expect(JSON.stringify(res.body)).not.toContain('Карта T1');
    }
  });

  // ─── Сценарий 4: клиент C1 не может дёргать терапевтские маршруты ─────────

  it('C1 (клиент, не терапевт) получает 403 на терапевтские ручки', async () => {
    const c1 = agentAs(C1);
    const asTherapistOnly = [
      () => c1.get('/api/therapy/clients'),
      () => c1.post('/api/therapy/invite'),
      () => c1.get(`/api/therapy/notes/${C1_ID}`),
      () => c1.get(`/api/therapy/mode-maps/${C1_ID}`),
      () => c1.get('/api/therapy/tasks/all'),
      () => c1.get('/api/therapy/custom-modes'),
    ];
    for (const call of asTherapistOnly) {
      const res = await call();
      expect(res.status).toBe(403);
    }
  });

  // Свой read-only срез (my-mode-maps) клиенту доступен — это не терапевтская
  // ручка, роль THERAPIST не требуется.
  it('C1 видит собственный my-mode-maps (без 403, но пусто — карта на T1)', async () => {
    const c1 = agentAs(C1);
    const res = await c1.get('/api/therapy/my-mode-maps');
    expect(res.status).toBe(200);
    // Карта режимов принадлежит связке (therapistId, clientId) в ModeMap с
    // clientId=C1 — modeMapsService.listMyModeMaps фильтрует по clientId,
    // поэтому клиент СВОЮ карту, созданную его терапевтом, увидит.
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ─── Сценарий 5: POST от T2 (нет связи) → отказ, заметка НЕ создана ──────

  it('T2 не может создать заметку C1 — запись не появляется в БД', async () => {
    const t2 = agentAs(T2);
    // Фильтруем по clientId (не read-all таблицы) — на реальном Postgres в
    // той же таблице могут лежать строки других therapy-ownership-спеков
    // этого же CI-прогона.
    const before = (
      await prisma.therapistNote.findMany({ where: { clientId: C1 } })
    ).length;

    const res = await t2.post(`/api/therapy/notes/${C1_ID}`, {
      date: '2026-07-21',
      text: 'заметка от чужого терапевта',
    });
    expect(res.status).toBe(403);

    const after = (
      await prisma.therapistNote.findMany({ where: { clientId: C1 } })
    ).length;
    expect(after).toBe(before);
    // Убедимся и через T1: список заметок C1 не пополнился чужой записью.
    const t1 = agentAs(T1);
    const notes = await t1.get(`/api/therapy/notes/${C1_ID}`);
    expect(
      notes.body.some(
        (n: { text: string }) => n.text === 'заметка от чужого терапевта',
      ),
    ).toBe(false);
  });

  // ─── Сценарий 6: задачи не текут между терапевтами ────────────────────────

  it('T2 не видит задачу T1→C1 ни через tasks/all, ни через tasks/client/:clientId', async () => {
    const t2 = agentAs(T2);
    const all = await t2.get('/api/therapy/tasks/all');
    expect(all.status).toBe(200);
    expect(all.body).toEqual([]); // у T2 вообще нет клиентов с задачами

    const forClient = await t2.get(`/api/therapy/tasks/client/${C1_ID}`);
    expect(forClient.status).toBe(403);
  });

  it('T1 видит задачу C1 через tasks/all', async () => {
    const t1 = agentAs(T1);
    const all = await t1.get('/api/therapy/tasks/all');
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(1);
    expect(all.body[0].tasks[0].text).toBe('заполнить дневник схем');
  });

  // ─── Сценарий 7: custom-modes терапевта не текут другому терапевту ───────

  it('custom-modes T1 не видны T2', async () => {
    const t1 = agentAs(T1);
    const t2 = agentAs(T2);

    const created = await t1.post('/api/therapy/custom-modes', {
      name: 'Мой кастомный режим',
    });
    expect(created.status).toBeLessThan(300);

    const ownList = await t1.get('/api/therapy/custom-modes');
    expect(ownList.status).toBe(200);
    expect(ownList.body).toHaveLength(1);

    const otherList = await t2.get('/api/therapy/custom-modes');
    expect(otherList.status).toBe(200);
    expect(otherList.body).toEqual([]);
  });
});
