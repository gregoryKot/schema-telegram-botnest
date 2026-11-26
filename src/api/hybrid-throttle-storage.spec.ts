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
  // In-memory часть (штатное ThrottlerStorageService) заводит таймер
  // выметания: onApplicationShutdown() за каждым тестом снимает его — хук
  // часть контракта обёртки (шов DI — hybrid-throttle-storage.shutdown.spec.ts).
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

// Сверка при возврате на штатное ThrottlerStorageService (@nestjs/throttler
// 6.7.1, docs/open/backend.md): ожидания ниже сняты со своего хранилища
// MemoryThrottleStorage (удалено) на тех же шагах — лимиты, окно и Retry-After
// (timeToBlockExpire при блоке) у ручек в памяти не сдвинулись. Формат шага:
// `хиты[B<сек до снятия блока>]/<сек до конца окна>`; timeToBlockExpire
// незаблокированного ключа ThrottlerGuard не читает — его не сравниваем.
describe('HybridThrottleStorage — лимиты в памяти совпадают с прежним хранилищем', () => {
  const GAPS = [
    0, 100, 100, 100, 100, 0, 0, 300, 400, 400, 1200, 0, 0, 0, 0, 0, 200,
    61_000, 0, 0, 5000, 0, 70_000, 0,
  ];
  const run = async (limit: number, ttl: number, block: number) => {
    jest.setSystemTime(1_000_000);
    const storage = new HybridThrottleStorage(fakePrisma(jest.fn()));
    const parts: string[] = [];
    for (const gap of GAPS) {
      jest.advanceTimersByTime(gap);
      const r = await storage.increment('K', ttl, limit, block, 'short');
      const blocked = r.isBlocked ? `B${r.timeToBlockExpire}` : '';
      parts.push(`${r.totalHits}${blocked}/${r.timeToExpire}`);
    }
    storage.onApplicationShutdown();
    return parts.join(' ');
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([
    [
      'short из throttler-module-options: 10 за 1с',
      10,
      1000,
      1000,
      '1/1 2/1 3/1 4/1 5/1 6/1 7/1 8/1 7/1 3/1 1/1 2/1 3/1 4/1 5/1 6/1 7/1 1/1 2/1 3/1 1/1 2/1 1/1 2/1',
    ],
    [
      'long из throttler-module-options: 200 за 60с',
      200,
      60_000,
      60_000,
      '1/60 2/60 3/60 4/60 5/60 6/60 7/60 8/60 9/59 10/59 11/58 12/58 13/58 14/58 15/58 16/58 17/58 1/60 2/60 3/60 4/55 5/55 1/60 2/60',
    ],
    [
      'окно 1с, лимит 3 — блок и Retry-After',
      3,
      1000,
      1000,
      '1/1 2/1 3/1 4B1/1 4B1/1 4B1/1 4B1/1 4B1/1 2B1/1 1/1 1/1 2/1 3/1 4B1/1 4B1/1 4B1/1 4B1/1 1/1 2/1 3/1 1/1 2/1 1/1 2/1',
    ],
    [
      'окно 60с, лимит 5 — Retry-After убывает с часами',
      5,
      60_000,
      60_000,
      '1/60 2/60 3/60 4/60 5/60 6B60/60 6B60/60 6B60/60 6B60/59 6B59/59 6B58/58 6B58/58 6B58/58 6B58/58 6B58/58 6B58/58 6B58/58 1/60 2/60 3/60 4/55 5/55 1/60 2/60',
    ],
    [
      'блок длиннее окна',
      2,
      1000,
      4000,
      '1/1 2/1 3B4/1 3B4/1 3B4/1 3B4/1 3B4/1 3B4/1 1B4/1 0B3/1 0B2/1 0B2/1 0B2/1 0B2/1 0B2/1 0B2/1 0B2/1 1/1 2/1 3B4/1 1/1 2/1 1/1 2/1',
    ],
    [
      'блок короче окна',
      4,
      3000,
      700,
      '1/3 2/3 3/3 4/3 5B1/3 5B1/3 5B1/3 5B1/3 1/2 2/2 3/1 4/1 5B1/1 5B1/1 5B1/1 5B1/1 5B1/1 1/3 2/3 3/3 1/3 2/3 1/3 2/3',
    ],
  ])('%s', async (_name, limit, ttl, block, expected) => {
    expect(await run(limit, ttl, block)).toBe(expected);
  });

  // Сценарий находки аудита 2026-10-11 (дефект 6.5.0): снятие блока ключа B
  // отменяло таймеры хитов ВСЕХ ключей троттлера, и старый хит A не истекал.
  it('снятие блока одного ключа не трогает хиты других', async () => {
    const storage = new HybridThrottleStorage(fakePrisma(jest.fn()));
    await storage.increment('A', 1000, 10, 1000, 'short');
    expect((await storage.increment('B', 1000, 0, 50, 'short')).isBlocked).toBe(
      true,
    );
    jest.advanceTimersByTime(60);
    await storage.increment('B', 1000, 0, 50, 'short'); // блок истёк
    jest.advanceTimersByTime(1000);
    expect(
      (await storage.increment('A', 1000, 10, 1000, 'short')).totalHits,
    ).toBe(1);
    storage.onApplicationShutdown();
  });
});
