// e2e SMOKE (TEST_IMPROVEMENT_PLAN.md, этап 1.2) — продолжение
// therapy-ownership.e2e-spec.ts. Отдельный файл (не хвост первого, чтобы
// уложиться в лимит ~300 строк на файл, правило №10 CLAUDE.md) и отдельная
// пара терапевт/клиент (T3/C2), чтобы не зависеть от порядка выполнения
// тестов в соседнем файле.
//
// Сценарий 3: T1 (тут — T3) РАЗРЫВАЕТ связь с клиентом (DELETE
// /api/therapy/relation — единственный реальный способ поменять статус
// связи, RelationStatus знает только pending/active, назад к pending код не
// переводит). После разрыва TherapyRelation-строка удаляется, но
// ModeMap/TherapistNote/ClientConceptualization, созданные ПОКА связь была
// активна, остаются в БД с прежним (therapistId, clientId). Регресс
// PR #66: getModeMap/updateModeMap искали карту только по
// id+therapistId и не перепроверяли активность связи — терапевт с разорванной
// связью всё ещё мог читать/писать чужую (бывшую) клиническую карту.
// mode-maps.service.ts сейчас держит "догоняющую" проверку
// assertHasClient во ВСЕХ мутаторах карты — этот тест фиксирует, что она
// не потеряется снова.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e smoke: therapy ownership — after disconnect (PR #66 regression)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const secret = () => process.env.JWT_SECRET as string;

  const T3 = 4_000_000_000_000_004n;
  const C2 = 4_000_000_000_000_005n;
  const C2_ID = Number(C2);
  const ALL_USER_IDS = [T3, C2];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    // Изоляция между прогонами (TEST_TRUST_PLAN.md, п.1) — см. комментарий
    // в app-ownership.e2e-spec.ts. На реальном Postgres обязательна и перед
    // прямой вставкой User-строк ниже (role: THERAPIST/CLIENT) — иначе
    // повторный локальный прогон падает на PK-конфликте id.
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
      patch: (url: string, body: object = {}) =>
        auth(request(app.getHttpServer()).patch(url)).send(body),
      delete: (url: string) => auth(request(app.getHttpServer()).delete(url)),
    };
  }

  let mapId: number;

  beforeAll(async () => {
    await prisma.user.create({ data: { id: T3, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: C2, role: 'CLIENT' } });

    const t3 = agentAs(T3);
    const c2 = agentAs(C2);
    const invite = await t3.post('/api/therapy/invite');
    expect(invite.status).toBeLessThan(300);
    const join = await c2.post('/api/therapy/join', { code: invite.body.code });
    expect(join.status).toBeLessThan(300);
    expect(join.body).toEqual({ ok: true });

    // Заметка, концептуализация, задача и карта режимов — все создаются
    // ПОКА связь активна, чтобы после разрыва проверить, что доступ к уже
    // существующим строкам всё равно закрывается.
    const note = await t3.post(`/api/therapy/notes/${C2_ID}`, {
      date: '2026-07-22',
      text: 'заметка до разрыва связи',
    });
    expect(note.status).toBeLessThan(300);

    const concept = await t3.post(`/api/therapy/conceptualization/${C2_ID}`, {
      earlyExperience: 'опыт клиента C2',
    });
    expect(concept.status).toBeLessThan(300);

    const task = await t3.post('/api/therapy/tasks', {
      type: 'custom',
      text: 'задача до разрыва связи',
      clientId: C2_ID,
    });
    expect(task.status).toBeLessThan(300);

    const map = await t3.post(`/api/therapy/mode-maps/${C2_ID}`, {
      title: 'Карта до разрыва связи',
    });
    expect(map.status).toBeLessThan(300);
    mapId = map.body.id as number;

    // Разрываем связь — единственный реальный способ поменять её статус.
    const disconnect = await t3.delete('/api/therapy/relation');
    expect(disconnect.status).toBeLessThan(300);
    expect(disconnect.body).toEqual({ ok: true });
  });

  it('после разрыва связи T3 не может читать mode-maps клиента (список)', async () => {
    const t3 = agentAs(T3);
    const res = await t3.get(`/api/therapy/mode-maps/${C2_ID}`);
    expect(res.status).toBe(403);
  });

  it('после разрыва связи T3 не может читать конкретную карту режимов по id (регресс PR #66)', async () => {
    const t3 = agentAs(T3);
    // Карта физически всё ещё в БД с therapistId=T3 — проверяем, что одной
    // сверки therapistId на строке недостаточно, нужна ЖИВАЯ связь.
    const mapRow = await prisma.modeMap.findUnique({ where: { id: mapId } });
    expect(mapRow).not.toBeNull();
    const res = await t3.get(`/api/therapy/mode-maps/map/${mapId}`);
    expect(res.status).toBe(403);
  });

  it('после разрыва связи T3 не может обновить карту режимов по id', async () => {
    const t3 = agentAs(T3);
    const res = await t3.patch(`/api/therapy/mode-maps/map/${mapId}`, {
      title: 'Попытка правки после разрыва',
    });
    expect(res.status).toBe(403);
  });

  it('после разрыва связи T3 не может читать заметки сессий C2', async () => {
    const t3 = agentAs(T3);
    const res = await t3.get(`/api/therapy/notes/${C2_ID}`);
    expect(res.status).toBe(403);
  });

  it('после разрыва связи T3 не может читать концептуализацию C2', async () => {
    const t3 = agentAs(T3);
    const res = await t3.get(`/api/therapy/conceptualization/${C2_ID}`);
    expect(res.status).toBe(403);
  });

  it('после разрыва связи T3 не может читать client-data C2', async () => {
    const t3 = agentAs(T3);
    const res = await t3.get(`/api/therapy/client-data/${C2_ID}`);
    expect(res.status).toBe(403);
  });

  it('после разрыва связи T3 не видит задачу C2 через tasks/client/:clientId', async () => {
    const t3 = agentAs(T3);
    const res = await t3.get(`/api/therapy/tasks/client/${C2_ID}`);
    expect(res.status).toBe(403);
  });
});
