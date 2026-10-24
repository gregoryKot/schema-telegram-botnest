// e2e ownership smoke (правило CLAUDE.md: новый эндпоинт = e2e-смок на
// ownership) для GET /api/account/export (право на переносимость данных,
// 152-ФЗ/GDPR art.15,20). Тот же AppModule/build-test-app.ts, что и соседние
// app-ownership*.e2e-spec.ts — см. их заголовки для деталей стенда.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import {
  cleanupOwnershipFixtures,
  seedUsers,
} from './e2e-support/cleanup-fixtures';

describe('e2e smoke: GET /api/account/export — ownership + состав выдачи', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const secret = () => process.env.JWT_SECRET as string;
  const USER_A = 1_000_000_000_000_101n;
  const USER_B = 1_000_000_000_000_102n;
  const ALL_USER_IDS = [USER_A, USER_B];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await seedUsers(prisma, ALL_USER_IDS);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL_USER_IDS);
    await app.close();
  });

  it('без токена — 401 (эндпоинт guarded)', async () => {
    const res = await request(app.getHttpServer()).get('/api/account/export');
    expect(res.status).toBe(401);
  });

  it('отдаёт РАСШИФРОВАННЫЕ данные владельца и НЕ отдаёт чужие (User B не видит записи User A)', async () => {
    const tokenA = signAccessToken(USER_A, secret());
    const tokenB = signAccessToken(USER_B, secret());
    const secretTextA = 'дневник пользователя A: секрет 2026-09-06';

    const saved = await request(app.getHttpServer())
      .post('/api/note')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: '2026-09-06', text: secretTextA, tags: ['важное'] });
    expect(saved.status).toBeLessThan(300);

    const exportA = await request(app.getHttpServer())
      .get('/api/account/export')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(exportA.status).toBe(200);
    expect(exportA.headers['content-disposition']).toMatch(/attachment/);
    expect(exportA.headers['content-disposition']).toMatch(
      /schemehappens-export-\d{4}-\d{2}-\d{2}\.json/,
    );

    // Расшифровка реально применилась — в файле лежит читаемый текст, а не
    // base64-шифроблоб (иначе право на переносимость — фикция).
    const noteA = exportA.body.data.Note.find(
      (n: { date: string }) => n.date === '2026-09-06',
    );
    expect(noteA).toBeDefined();
    expect(noteA.text).toBe(secretTextA);

    // Owner-изоляция: тот же путь, чужой токен — чужие записи не протекают.
    const exportB = await request(app.getHttpServer())
      .get('/api/account/export')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(exportB.status).toBe(200);
    expect(exportB.body.data.Note).toEqual([]);
    expect(exportB.body.account.id).toBe(Number(USER_B));
    expect(JSON.stringify(exportB.body)).not.toContain(secretTextA);

    // withheld — человек видит, чего нет и почему, а не молчание.
    const withheldTables = exportA.body.withheld.map(
      (w: { table: string }) => w.table,
    );
    expect(withheldTables).toEqual(
      expect.arrayContaining(['EmailToken', 'LoginTicket', 'WebSession']),
    );
  });
});
