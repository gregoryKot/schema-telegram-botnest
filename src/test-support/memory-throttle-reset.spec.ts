// Регресс мигалки test/refresh-rotation.e2e-spec.ts (разбор 2026-10-15, см.
// шапку memory-throttle-reset.ts): сброс троттлера между сценариями стирал
// записи, оставляя таймеры истечения, и таймер падал TypeError. Время здесь
// фейковое: в e2e попадание таймера в окно зависело от нагрузки машины, тут
// порядок «хит → сброс → истечение» задан руками и воспроизводится всегда.
import { ThrottlerStorageService } from '@nestjs/throttler';
import { HybridThrottleStorage } from '../api/hybrid-throttle-storage';
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

  // Контрольный образец: приём «стереть одну Map библиотеки», что жил в спеке
  // до разбора. Форма провала зависит от версии @nestjs/throttler, класс один:
  //  - 6.5.0: таймер на каждый хит берёт запись без проверки и падает
  //    TypeError, когда записи уже нет;
  //  - 6.7.1: таймеров на хит нет, счётчик восстанавливается из
  //    hitExpirations — следующий хит не свежий (totalHits > 1).
  // Не провалился ни так, ни так — разбор выше устарел, его надо перечитать.
  it('контроль: стереть только записи — это не сброс (таймер падает или счётчик живёт)', async () => {
    // Две независимые проверки на двух хранилищах: время идёт только вперёд.
    const timers = new ThrottlerStorageService();
    await hit(timers);
    timers.storage.clear();
    let threw = false;
    try {
      jest.advanceTimersByTime(TTL);
    } catch {
      threw = true;
    }
    timers.onApplicationShutdown();

    const counter = new ThrottlerStorageService();
    await hit(counter);
    counter.storage.clear();
    const next = await hit(counter);
    counter.onApplicationShutdown();

    expect(threw || next.totalHits > 1).toBe(true);
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

  it('чужая форма хранилища — громкая ошибка, а не тихий no-op', () => {
    expect(() => resetMemoryThrottle({ increment: jest.fn() })).toThrow(
      /не найдено in-memory хранилище/,
    );
    expect(() => resetMemoryThrottle({ memory: undefined })).toThrow(
      /не найдено in-memory хранилище/,
    );
  });
});
