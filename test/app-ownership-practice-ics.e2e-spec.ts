// e2e SMOKE: .ics шага плана по https (аудит 2026-11, E6; правило «новый
// контроллер = e2e-смок»). В Telegram файл с устройства (data:-URL) не
// открыть — openLink пускает только http(s). Ссылку выдаёт вошедшему POST,
// файл по ней отдаёт GET без входа (внешний браузер нашей сессии не знает).
// Проверяем через настоящий HTTP-стек: гвард на POST примонтирован, DTO
// применён, GET отдаёт text/calendar только по выданному сервером токену.
// Владельца у файла нет: «чужое» здесь — любой токен, которого сервер не
// выдавал (подделка, обрезка).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import {
  cleanupOwnershipFixtures,
  seedUsers,
} from './e2e-support/cleanup-fixtures';

describe('e2e smoke: .ics шага плана по ссылке (POST /api/plan/ics)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const USER = 1_000_000_000_000_301n;
  const BODY = {
    text: 'Позвонить маме',
    needLabel: 'Привязанность',
    startMs: Date.UTC(2092, 3, 20, 16),
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, [USER]);
    await seedUsers(prisma, [USER]);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, [USER]);
    await app.close();
  });

  const bearer = () =>
    `Bearer ${signAccessToken(USER, process.env.JWT_SECRET as string)}`;

  it('без входа ссылку не выдают', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/plan/ics')
      .send(BODY);
    expect(res.status).toBe(401);
  });

  it('DTO на месте: текст длиннее предела и строка вместо времени — 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/plan/ics')
      .set('Authorization', bearer())
      .send({ ...BODY, text: 'я'.repeat(201), startMs: 'завтра' });
    expect(res.status).toBe(400);
  });

  it('выданная ссылка открывается без входа и отдаёт событие; подделка — 404', async () => {
    const link = await request(app.getHttpServer())
      .post('/api/plan/ics')
      .set('Authorization', bearer())
      .send(BODY);
    expect(link.status).toBe(200);
    const path = link.body.path as string;
    expect(path).toMatch(/^\/api\/plan\/ics\/[A-Za-z0-9_-]+$/);
    expect(path).not.toContain(encodeURIComponent('маме'));
    const token = path.split('/').pop() as string;

    const file = await request(app.getHttpServer()).get(
      `/api/plan/ics/${token}`,
    );
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('text/calendar');
    expect(file.headers['content-disposition']).toContain(
      'attachment; filename="practice.ics"',
    );
    expect(file.text).toContain('SUMMARY:Позвонить маме');
    expect(file.text).toContain('DTSTART:20920420T160000Z');

    const forged =
      token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    const bad = await request(app.getHttpServer()).get(
      `/api/plan/ics/${forged}`,
    );
    expect(bad.status).toBe(404);
  });
});
