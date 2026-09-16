// Инцидент 2026-09-13: троттлинг денежных/заявочных ручек переехал в
// Postgres (правило №5/№18 CLAUDE.md). Юнит на моке Prisma — свойство
// ДРАЙВЕРА (умеет ли Postgres/Prisma прочитать конкретный SQL) он не
// доказывает, это делает test/throttle-storage.e2e-spec.ts на живой базе;
// здесь проверяется только маршрутизация по ключу и деградация в память.
import { Logger } from '@nestjs/common';
import { HybridThrottleStorage } from './hybrid-throttle-storage';

function fakePrisma(queryRaw: jest.Mock) {
  return { $queryRaw: queryRaw } as any;
}

describe('HybridThrottleStorage — маршрутизация по префиксу ключа', () => {
  // Штатное in-memory хранилище (`this.memory`) ставит реальный setTimeout на
  // истечение ключа (тут — до 60_000мс). Без вызова onApplicationShutdown()
  // таймер переживает тест и держит event loop открытым — обычный `npx jest`
  // это маскирует принудительным выходом воркера, а `--detectOpenHandles
  // --forceExit=false` (nightly.yml, джоба backend-flaky) висит на нём вечно.
  // Та же причина, что у инцидента в hybrid-throttle-storage.shutdown.spec.ts,
  // только тут таймер настоящий, а не фейковый — чистим за каждым тестом.
  let storage: HybridThrottleStorage;

  afterEach(() => {
    storage.onApplicationShutdown();
  });

  it('ключ без db: — считается в памяти, Postgres не трогаем', async () => {
    const queryRaw = jest.fn();
    storage = new HybridThrottleStorage(fakePrisma(queryRaw));

    const first = await storage.increment('plain-key', 1000, 5, 1000, 'short');
    const second = await storage.increment('plain-key', 1000, 5, 1000, 'short');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('ключ db: — идёт в Postgres, результат берётся из строки $queryRaw', async () => {
    const now = new Date();
    const queryRaw = jest.fn().mockResolvedValue([
      {
        hits: 3,
        expiresAt: new Date(now.getTime() + 30_000),
        blockedUntil: null,
      },
    ]);
    storage = new HybridThrottleStorage(fakePrisma(queryRaw));

    const rec = await storage.increment(
      'db:some-key',
      60_000,
      6,
      60_000,
      'long',
    );

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(rec.totalHits).toBe(3);
    expect(rec.isBlocked).toBe(false);
  });

  it('Postgres упал — деградация в память (warn, не error) с тем же ключом', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const queryRaw = jest
      .fn()
      .mockRejectedValue(new Error('connection terminated'));
    storage = new HybridThrottleStorage(fakePrisma(queryRaw));

    const rec = await storage.increment(
      'db:booking:1',
      60_000,
      6,
      60_000,
      'long',
    );

    expect(rec.totalHits).toBe(1); // упало в свежую in-memory запись
    expect(rec.isBlocked).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('деградация — второй вызов того же db:-ключа копит счётчик в памяти', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const queryRaw = jest.fn().mockRejectedValue(new Error('down'));
    storage = new HybridThrottleStorage(fakePrisma(queryRaw));

    await storage.increment('db:x', 60_000, 6, 60_000, 'long');
    const second = await storage.increment('db:x', 60_000, 6, 60_000, 'long');

    expect(second.totalHits).toBe(2);
    warn.mockRestore();
  });
});
