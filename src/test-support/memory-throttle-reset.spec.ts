// Сброс умеет обе формы: MemoryThrottleStorage (прод) и голый штатный.
// Регресс мигалки test/refresh-rotation.e2e-spec.ts (разбор 2026-10-15, см.
// шапку memory-throttle-reset.ts): сброс троттлера между сценариями стирал
// записи, оставляя таймеры истечения, и таймер падал TypeError. Время здесь
// фейковое: в e2e попадание таймера в окно зависело от нагрузки машины, тут
// порядок «хит → сброс → истечение» задан руками и воспроизводится всегда.
import { ThrottlerStorageService } from '@nestjs/throttler';
import { HybridThrottleStorage } from '../api/hybrid-throttle-storage';
import { MemoryThrottleStorage } from '../api/memory-throttle-storage';
import type { PrismaService } from '../prisma/prisma.service';
import { resetMemoryThrottle } from './memory-throttle-reset';

// Ключи без `db:` в Postgres не ходят — Prisma этим тестам не нужна.
const noPrisma = {} as unknown as PrismaService;
const TTL = 1000;
const hit = (s: { increment: ThrottlerStorageService['increment'] }) =>
  s.increment('refresh-ip', TTL, 20, TTL, 'short');

describe('resetMemoryThrottle — сброс троттлера в памяти между e2e-сценариями', () => {
  let storage: HybridThrottleStorage;

  beforeEach(() => {
    jest.useFakeTimers();
    storage = new HybridThrottleStorage(noPrisma);
  });

  afterEach(() => {
    storage.onApplicationShutdown();
    jest.useRealTimers();
  });

  // Контрольный образец: ровно тот приём, что жил в спеке до разбора. Если
  // библиотека когда-нибудь начнёт переживать пропажу записи, этот тест
  // покраснеет — значит, разбор выше устарел и его надо перечитать.
  it('контроль: стереть записи и оставить таймеры — таймер хита падает', async () => {
    const lib = new ThrottlerStorageService();
    await hit(lib);
    lib.storage.clear();
    expect(() => jest.advanceTimersByTime(TTL)).toThrow(
      /Cannot destructure property 'totalHits'/,
    );
    lib.onApplicationShutdown();
  });

  it('таймер хита, сделанного до сброса, истекает после него без ошибки', async () => {
    await hit(storage);
    resetMemoryThrottle(storage);
    expect(() => jest.advanceTimersByTime(TTL)).not.toThrow();
  });

  it('таймер хита до сброса не вычитает хит из записи, заведённой после', async () => {
    await hit(storage);
    jest.advanceTimersByTime(TTL / 2);
    resetMemoryThrottle(storage);
    await hit(storage);
    // Таймер первого хита истёк бы здесь, таймер второго — ещё нет.
    jest.advanceTimersByTime(TTL / 2 + 100);
    expect((await hit(storage)).totalHits).toBe(2);
  });

  it('лимит, исчерпанный до сброса, после сброса не мешает', async () => {
    for (let i = 0; i < 21; i++) await hit(storage);
    expect((await hit(storage)).isBlocked).toBe(true);
    resetMemoryThrottle(storage);
    const after = await hit(storage);
    expect(after.totalHits).toBe(1);
    expect(after.isBlocked).toBe(false);
  });

  it('голый ThrottlerStorageService (сборка без гибрида) сбрасывается так же', async () => {
    const lib = new ThrottlerStorageService();
    await hit(lib);
    resetMemoryThrottle(lib);
    expect(() => jest.advanceTimersByTime(TTL)).not.toThrow();
    expect(lib.storage.size).toBe(0);
  });

  it('MemoryThrottleStorage без обёртки сбрасывается через reset()', async () => {
    const own = new MemoryThrottleStorage();
    await hit(own);
    resetMemoryThrottle(own);
    expect(own.size).toBe(0);
    expect((await hit(own)).totalHits).toBe(1);
  });

  it('чужая форма хранилища — громкая ошибка, а не тихий no-op', () => {
    expect(() => resetMemoryThrottle({ increment: jest.fn() })).toThrow(
      /не найдено in-memory хранилище/,
    );
    expect(() => resetMemoryThrottle({ memory: undefined })).toThrow(
      /не найдено in-memory хранилище/,
    );
  });
});
