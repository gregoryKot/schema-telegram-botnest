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
import { ThrottleHitCleanupService } from '../src/api/throttle-hit.cleanup';
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

describe('ThrottleHitCleanupService на реальном Postgres', () => {
  // Аудит 2026-10: крон уборки не имел ни одного теста. Перевод
  // `{ blockedUntil: null }` в IS NULL и сравнение timestamp(3) с JS Date
  // проверяет драйвер, а не фейк. Запас везде в часах: часы JS и Postgres
  // расходятся, а границу «ровно сутки» держит юнит-спек уборки.
  const H = 60 * 60 * 1000;
  const at = (offsetMs: number) => new Date(Date.now() + offsetMs);
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  beforeEach(() => wipe(prisma));
  afterAll(async () => {
    await wipe(prisma);
    await prisma.$disconnect();
  });

  it('убирает давно истёкшие строки и оставляет живые, недавние и заблокированные', async () => {
    await prisma.throttleHit.createMany({
      data: [
        { key: 'live', hits: 1, expiresAt: at(H), blockedUntil: null },
        { key: 'expired-2h', hits: 1, expiresAt: at(-2 * H) },
        { key: 'expired-2d', hits: 1, expiresAt: at(-48 * H) },
        {
          key: 'expired-2d-block-lifted',
          hits: 9,
          expiresAt: at(-48 * H),
          blockedUntil: at(-2 * H),
        },
        {
          // Окно давно истекло, но блок ещё действует: его держит только OR.
          key: 'expired-2d-block-active',
          hits: 9,
          expiresAt: at(-48 * H),
          blockedUntil: at(H),
        },
      ],
    });
    // Строка, записанная настоящим increment (ключ и формат — как в проде).
    const storage = new PostgresThrottleStorage(prisma);
    await storage.increment('real-key', 60_000, 6, 60_000);

    await new ThrottleHitCleanupService(prisma).cleanup();

    const left = await prisma.throttleHit.findMany({ select: { key: true } });
    expect(left.map((r) => r.key).sort()).toEqual([
      'expired-2d-block-active',
      'expired-2h',
      'live',
      'real-key',
    ]);
  });
});

// Находка аудита 2026-10: кодовые и заявочные ручки (merge с TOTP, билеты,
// confirm-login, заявка терапевта) считали попытки в памяти процесса — деплой
// обнулял окно, и 8-символьный код человека перебирался окнами «20 в час»,
// склеенными рестартами. Шов — второй app над той же БД: модель деплоя и
// второго инстанса Amvera. Мок $queryRaw этого не доказывает (правило №18).
describe('e2e HTTP: лимит кодовых ручек переживает рестарт приложения', () => {
  let prisma: PrismaService;
  const apps: INestApplication[] = [];

  afterAll(async () => {
    await prisma?.throttleHit.deleteMany({});
    await Promise.all(apps.map((a) => a.close()));
  });

  async function boot(fresh: boolean): Promise<INestApplication> {
    const built = await buildRealDbTestApp();
    apps.push(built.app);
    prisma = built.prisma;
    // Второй app над той же БД счётчики не трогает — это и есть рестарт.
    if (fresh) await prisma.throttleHit.deleteMany({});
    return built.app;
  }

  it('POST /api/auth/merge: три попытки — 400, четвёртая — 429, после рестарта сразу 429', async () => {
    const first = await boot(true);
    const post = (a: INestApplication) =>
      request(a.getHttpServer()).post('/api/auth/merge').send({});
    const statuses: number[] = [];
    let last: request.Response | undefined;
    for (let i = 0; i < 4; i++) {
      last = await post(first);
      statuses.push(last.status);
    }
    expect(statuses).toEqual([400, 400, 400, 429]);
    // Текст 429 через настоящий путь Postgres-счётчика — русский, со сроком
    // из счётчика (окно STRICT_THROTTLE.short — минута), а не «ThrottlerException…»
    // (аудит 2026-10, сырой текст сервера на экранах входа). Глобальных
    // фильтров main.ts buildRealDbTestApp не ставит; форму тела при
    // GenericExceptionFilter держит src/api/throttler-module-options.spec.ts.
    expect(last?.body).toEqual({
      statusCode: 429,
      message: 'Слишком много попыток подряд. Повторить можно через минуту',
    });

    await first.close();
    const second = await boot(false);
    expect((await post(second)).status).toBe(429);
    expect(await prisma.throttleHit.count()).toBeGreaterThan(0);
  });

  it('POST /api/therapy/request (окно 24 ч): второй app видит то же окно', async () => {
    // Идентичность для бакета — IP (Bearer нет): гард троттлинга срабатывает
    // раньше авторизации, как и у booking/book выше.
    const first = await boot(true);
    const post = (a: INestApplication) =>
      request(a.getHttpServer()).post('/api/therapy/request').send({});
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await post(first)).status);
    // Без Bearer ручка отвечает 401, а лимит 2 в окне 24 ч срабатывает на
    // третьей попытке: гард троттлинга стоит раньше авторизации.
    expect(statuses).toEqual([401, 401, 429]);

    await first.close();
    const second = await boot(false);
    expect((await post(second)).status).toBe(429);
  });
});
