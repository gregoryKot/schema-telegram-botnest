// e2e: админская аналитика закрыта ключом админки (x-admin-key), days
// валидируется, неизвестный раздел отчёта — 404. Цифры из базы здесь не
// проверяются: группировки живут на реальном Postgres (raw-sql-live-admin-analytics).
process.env.ADMIN_BOOKING_KEY = 'e2e-analytics-admin-key-0123456789abcdef';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './e2e-support/build-test-app';

const KEY = process.env.ADMIN_BOOKING_KEY;
const BASE = '/api/analytics/admin';

describe('e2e: /api/analytics/admin', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, key?: string) => {
    const req = request(app.getHttpServer()).get(`${BASE}${path}`);
    return key ? req.set('x-admin-key', key) : req;
  };

  it.each([
    '/overview',
    '/therapists',
    '/people',
    '/sections',
    '/sections/main',
  ])('%s без ключа и с чужим ключом — 403', async (path) => {
    expect((await get(path)).status).toBe(403);
    expect((await get(path, 'x'.repeat(40))).status).toBe(403);
  });

  it('sections с ключом: «Главные цифры» первыми, затем разделы /stats', async () => {
    const res = await get('/sections', KEY);
    expect(res.status).toBe(200);
    expect(res.body[0]).toEqual({ id: 'main', title: 'Главные цифры' });
    expect(res.body.map((s: { id: string }) => s.id)).toContain('system');
  });

  it('неизвестный раздел — 404', async () => {
    expect((await get('/sections/nope', KEY)).status).toBe(404);
  });

  it.each(['/overview?days=5', '/therapists?days=abc', '/people?days=0'])(
    '%s — 400: окно только 7, 30 или 90',
    async (path) => {
      expect((await get(path, KEY)).status).toBe(400);
    },
  );
});
