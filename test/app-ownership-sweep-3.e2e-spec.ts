// e2e SMOKE — продолжение app-ownership-sweep-2.e2e-spec.ts (TEST_IMPROVEMENT_
// PLAN.md, этап 1.3): последний блок непокрытых guarded-маршрутов —
// трекер-агрегаты (history/streak/activity/export/insights/achievements/
// note/childhood-ratings). Все они читают только СВОИ данные (WHERE userId в
// сервисе) — тест проверяет, что после того, как A оставил след (рейтинг/
// заметку/флаг), B на тех же ручках видит пустое/дефолтное состояние, а не
// данные A. Плюс один BUG-тест на /api/settings — см. комментарий у него.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e smoke: ownership sweep 3 (tracker aggregates + settings)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const secret = () => process.env.JWT_SECRET as string;
  const USER_A = 6_000_000_000_000_001n;
  const USER_B = 6_000_000_000_000_002n;
  const ALL_USER_IDS = [USER_A, USER_B];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    // Изоляция между прогонами (TEST_TRUST_PLAN.md, п.1) — см. комментарий
    // в app-ownership.e2e-spec.ts. Обязательна на реальном Postgres, no-op
    // на фейке. Особо важна здесь: streak/insights/achievements читают ВСЮ
    // историю юзера — мусор от прошлого локального прогона портит счётчики.
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
    };
  }

  const a = agentAs(USER_A);
  const b = agentAs(USER_B);

  it('GET /api/needs: статический список 5 потребностей, без авторизации данных', async () => {
    const res = await a.get('/api/needs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });

  it('A оставляет сегодняшний рейтинг — история/стрик/инсайты/достижения видят это только у A', async () => {
    const rated = await a.post('/api/rating', {
      needId: 'attachment',
      value: 8,
    });
    expect(rated.status).toBeLessThan(300);

    const activity = await a.post('/api/activity');
    expect(activity.status).toBeLessThan(300); // 201 — POST has no @HttpCode override
    expect(activity.body).toEqual({ ok: true });

    const aHistory = await a.get('/api/history?days=7');
    expect(aHistory.status).toBe(200);
    expect(aHistory.body.length).toBeGreaterThan(0);
    const bHistory = await b.get('/api/history?days=7');
    expect(bHistory.body).toEqual([]);

    const aStreak = await a.get('/api/streak');
    expect(aStreak.status).toBe(200);
    expect(aStreak.body.todayDone).toBe(true);
    expect(aStreak.body.totalDays).toBeGreaterThan(0);
    const bStreak = await b.get('/api/streak');
    expect(bStreak.body.todayDone).toBe(false);
    expect(bStreak.body.totalDays).toBe(0);

    const aInsights = await a.get('/api/insights');
    expect(aInsights.status).toBe(200);
    expect(aInsights.body.totalDays).toBeGreaterThan(0);
    const bInsights = await b.get('/api/insights');
    expect(bInsights.body.totalDays).toBe(0);

    const aAchievements = await a.get('/api/achievements');
    expect(aAchievements.status).toBe(200);
    const aFirstDay = aAchievements.body.find(
      (x: { id: string }) => x.id === 'first_day',
    );
    expect(aFirstDay.earned).toBe(true);
    const bAchievements = await b.get('/api/achievements');
    const bFirstDay = bAchievements.body.find(
      (x: { id: string }) => x.id === 'first_day',
    );
    expect(bFirstDay.earned).toBe(false);

    const aExport = await a.get('/api/export');
    expect(aExport.status).toBe(200);
    expect(typeof aExport.body.text).toBe('string');
    expect(aExport.body.text).toContain('Трекер потребностей');
  });

  it('note: B не видит дневную заметку A за ту же дату', async () => {
    const date = '2099-03-03';
    const saved = await a.post('/api/note', {
      date,
      text: 'секрет A',
      tags: ['t1'],
    });
    expect(saved.status).toBeLessThan(300);

    const aNote = await a.get(`/api/note?date=${date}`);
    expect(aNote.body.text).toBe('секрет A');

    const bNote = await b.get(`/api/note?date=${date}`);
    expect(bNote.body.text).toBeNull();
  });

  it('childhood-ratings: B не видит «детский» опросник A', async () => {
    const saved = await a.post('/api/childhood-ratings', {
      attachment: 7,
      safety: 5,
    });
    expect(saved.status).toBeLessThan(300);

    const aRatings = await a.get('/api/childhood-ratings');
    expect(aRatings.body.attachment).toBe(7);

    const bRatings = await b.get('/api/childhood-ratings');
    expect(bRatings.body.attachment).toBeUndefined();
  });

  // Регрессия инцидента 2026-07-27: после распила api.controller (PR #43)
  // SettingsController существовал, но НЕ был зарегистрирован в ApiModule —
  // GET/POST /api/settings отдавали 404 на проде (экраны настроек били в
  // пустоту). Этот e2e-смок и поймал дыру; контроллер возвращён в модуль.
  // Тест держит связку: смонтирован + сохранение→чтение + изоляция A/B.
  it('регресс: /api/settings смонтирован; сохранил → прочитал; B не видит настройку A', async () => {
    const updated = await a.post('/api/settings', { addressForm: 'vy' });
    expect(updated.status).toBeLessThan(300);
    const got = await a.get('/api/settings');
    expect(got.status).toBe(200);
    expect(got.body.addressForm).toBe('vy');
    const other = await b.get('/api/settings');
    expect(other.status).toBe(200);
    expect(other.body.addressForm).not.toBe('vy');
  });
});
