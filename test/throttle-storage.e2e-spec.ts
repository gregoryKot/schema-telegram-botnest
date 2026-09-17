// Инцидент 2026-09-13: троттлинг денежных/заявочных ручек считался в памяти
// процесса — на двух инстансах Amvera счётчик не общий, лимит POST
// /api/booking/book обходился ротацией инстанса. Атомарность нового счётчика
// (ON CONFLICT DO UPDATE с CASE на строке конфликта) — свойство Postgres, не
// нашего кода; мок $queryRaw отвечает что угодно (правило №18 CLAUDE.md,
// см. src/api/postgres-throttle-storage.ts). Гоняется в джобе `migrations`.
//
// Таблица ThrottleHit в этой БД — только для троттлинга, посторонних
// потребителей нет, поэтому уборка между блоками — полный `deleteMany({})`,
// а не выборка по префиксу ключа (реальные ключи — sha256-хэши маршрута,
// предсказать их строкой нельзя, см. src/api/postgres-throttle-storage.ts).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { PostgresThrottleStorage } from '../src/api/postgres-throttle-storage';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';

async function wipe(prisma: PrismaService) {
  await prisma.throttleHit.deleteMany({});
}

describe('PostgresThrottleStorage на реальном Postgres', () => {
  let prisma: PrismaService;
  let storage: PostgresThrottleStorage;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  beforeEach(() => wipe(prisma));
  afterAll(async () => {
    await wipe(prisma);
    await prisma.$disconnect();
  });

  beforeAll(() => {
    storage = new PostgresThrottleStorage(prisma);
  });

  it('limit=6: первые шесть не блокированы (hits 1..6), седьмой заблокирован', async () => {
    const key = 'limit6';
    const results = [];
    for (let i = 0; i < 7; i++) {
      results.push(await storage.increment(key, 60_000, 6, 60_000));
    }
    results.slice(0, 6).forEach((r, i) => {
      expect(r.isBlocked).toBe(false);
      expect(r.totalHits).toBe(i + 1);
    });
    expect(results[6].isBlocked).toBe(true);
    expect(results[6].timeToBlockExpire).toBeGreaterThan(0);
  });

  it('два экземпляра хранилища на одном ключе делят один счётчик (модель двух инстансов)', async () => {
    const key = 'two-instances';
    const prismaA = new PrismaService();
    const prismaB = new PrismaService();
    const storageA = new PostgresThrottleStorage(prismaA);
    const storageB = new PostgresThrottleStorage(prismaB);
    try {
      for (let i = 0; i < 3; i++)
        await storageA.increment(key, 60_000, 6, 60_000);
      for (let i = 0; i < 3; i++)
        await storageB.increment(key, 60_000, 6, 60_000);
      const seventh = await storageA.increment(key, 60_000, 6, 60_000);
      expect(seventh.totalHits).toBe(7);
      expect(seventh.isBlocked).toBe(true);
    } finally {
      await prismaA.$disconnect();
      await prismaB.$disconnect();
    }
  });

  it('10 параллельных increment одного ключа — ровно набор hits 1..10 без дублей (атомарность)', async () => {
    const key = 'concurrent';
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        storage.increment(key, 60_000, 100, 60_000),
      ),
    );
    const hits = results.map((r) => r.totalHits).sort((a, b) => a - b);
    expect(hits).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('окно истекло — hits снова 1 (новое окно)', async () => {
    const key = 'window-expiry';
    await storage.increment(key, 1_000, 100, 60_000);
    await storage.increment(key, 1_000, 100, 60_000);
    await new Promise((r) => setTimeout(r, 1_200));
    const afterExpiry = await storage.increment(key, 1_000, 100, 60_000);
    expect(afterExpiry.totalHits).toBe(1);
  });

  it('блок истёк — счётчик сброшен', async () => {
    const key = 'block-expiry';
    // limit=1, blockDuration=1с: второй запрос сразу блокирует на 1с.
    await storage.increment(key, 60_000, 1, 1_000);
    const blocked = await storage.increment(key, 60_000, 1, 1_000);
    expect(blocked.isBlocked).toBe(true);
    await new Promise((r) => setTimeout(r, 1_200));
    const afterBlock = await storage.increment(key, 60_000, 1, 1_000);
    expect(afterBlock.isBlocked).toBe(false);
    expect(afterBlock.totalHits).toBe(1);
  });
});

describe('e2e HTTP: троттлинг booking/book через Postgres (модель двух инстансов)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
  });

  beforeEach(() => wipe(prisma));
  afterAll(async () => {
    await wipe(prisma);
    await app.close();
  });

  it('семь POST /api/booking/book с пустым телом: первые шесть — 400 (валидация), седьмой — 429 (гард раньше пайпа)', async () => {
    // Без auth-заголовков трекер падает на req.ip — supertest шлёт все семь с
    // одного и того же соединения, бакет стабильно один и тот же.
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/booking/book')
        .send({});
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 6)).toEqual(Array(6).fill(400));
    expect(statuses[6]).toBe(429);

    const rows = await prisma.throttleHit.count();
    expect(rows).toBeGreaterThan(0);
  });

  it('маршрут без @PersistentThrottle() не создаёт строк в ThrottleHit', async () => {
    await request(app.getHttpServer()).get('/api/booking/options');
    const rows = await prisma.throttleHit.count();
    expect(rows).toBe(0);
  });
});
