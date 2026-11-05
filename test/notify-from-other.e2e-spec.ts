// e2e класса 20 «Канал есть не у каждого адресата» (docs/INCIDENTS.md, QA
// клиента 2026-11-03, #912): уведомление, которое один человек ставит
// другому, — второй канал, а не единственный. Сообщение бота дойдёт только до
// того, у кого есть вход через Telegram; у аккаунта сайта очередь его снимет.
// Поэтому та же ручка, что ставит уведомление, обязана оставить след в
// данных, который адресат видит на сайте. Реестр типов и их следов —
// src/notification/notification-channels.ts; этот спек — доказательство для
// каждой записи `from_other` (сверку «спек называет тип и ручку» держит
// notification-channels.spec.ts).
//
// Адресаты здесь — аккаунты без Telegram (id из веб-диапазона): ровно тот,
// кому сообщение бота не дойдёт. Гоняется дважды: фейковая Prisma (джоба
// backend) и живой Postgres (E2E_REAL_DB=1, джоба migrations).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { NEED_IDS } from '../src/bot/bot.service';

const T = 4_800_000_000_001n; // терапевт
const C = 1_000_000_000_480_002n; // клиент с входом через сайт
const A = 1_000_000_000_480_003n; // напарник, заполняет трекер
const B = 1_000_000_000_480_004n; // напарник-адресат
const ALL = [T, C, A, B];
jest.setTimeout(60_000);

describe('e2e: уведомление от другого человека оставляет след на сайте (класс 20)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const act = (userId: bigint) => {
    const token = signAccessToken(userId, process.env.JWT_SECRET as string);
    const send = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const http = () => request(app.getHttpServer());
    return {
      get: (u: string) => send(http().get(u)),
      post: (u: string, b: object = {}) => send(http().post(u)).send(b),
    };
  };
  // Поставленные адресату уведомления этого типа (сообщение бота).
  const queued = async (userId: bigint, type: string) =>
    (
      await prisma.scheduledNotification.findMany({ where: { userId, type } })
    ).filter((n: { cancelledAt: Date | null }) => !n.cancelledAt).length;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await prisma.user.create({
      data: { id: T, role: 'THERAPIST', firstName: 'Анна' },
    });
    // Частота напоминаний — @default схемы, фейк дефолтов не знает: без них
    // каденс после заполнения трекера (registerFill) считал бы дату из NaN.
    const cadence = { notifyFrequency: 0, notifyAdaptiveLevel: 0 };
    for (const id of [C, A, B])
      await prisma.user.create({ data: { id, role: 'CLIENT', ...cadence } });
    const inv = await act(T).post('/api/therapy/invite');
    const join = await act(C).post('/api/therapy/join', {
      code: inv.body.code,
    });
    expect(join.body).toEqual({ ok: true });
    const pair = await act(A).post('/api/pair/invite');
    expect(
      (await act(B).post('/api/pair/join', { code: pair.body.code })).body,
    ).toEqual({ ok: true });
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  it("'task_assigned': задание терапевта видно клиенту в /api/therapy/tasks", async () => {
    const r = await act(T).post('/api/therapy/tasks', {
      type: 'custom',
      text: 'дневник схем',
      clientId: String(C),
    });
    expect(r.status).toBeLessThan(300);
    expect(await queued(C, 'task_assigned')).toBe(1);
    const tasks = await act(C).get('/api/therapy/tasks');
    expect(
      tasks.body.map((t: { text: string; assignedBy: number }) => [
        t.text,
        t.assignedBy,
      ]),
    ).toContainEqual(['дневник схем', Number(T)]);
  });

  it("'ysq_requested': запрос теста — задание ysq_test в /api/therapy/tasks", async () => {
    const r = await act(T).post(`/api/therapy/request-ysq/${String(C)}`);
    expect(r.status).toBeLessThan(300);
    expect(await queued(C, 'ysq_requested')).toBe(1);
    const tasks = await act(C).get('/api/therapy/tasks');
    expect(
      tasks.body.map((t: { type: string; assignedBy: number }) => [
        t.type,
        t.assignedBy,
      ]),
    ).toContainEqual(['ysq_test', Number(T)]);
  });

  it("'pair_activity': напарник заполнил трекер — его день виден в /api/pair", async () => {
    expect(await queued(B, 'pair_activity')).toBe(0);
    for (const needId of NEED_IDS) {
      const r = await act(A).post('/api/rating', { needId, value: 7 });
      expect(r.status).toBeLessThan(300);
    }
    expect(await queued(B, 'pair_activity')).toBe(1);
    const pair = await act(B).get('/api/pair');
    expect(pair.status).toBe(200);
    expect(pair.body.partners).toHaveLength(1);
    expect(pair.body.partners[0]).toMatchObject({
      partnerTodayDone: true,
      partnerIndex: 7,
    });
  });
});
