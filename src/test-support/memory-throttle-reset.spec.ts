// Сброс троттлера в памяти между e2e-сценариями (шапка memory-throttle-reset.ts).
// Регресс мигалки test/refresh-rotation.e2e-spec.ts (разбор 2026-10-15): сброс
// стирал одну Map записей, а хиты жили дальше. Время фейковое: порядок «хит →
// сброс → истечение» задан руками и воспроизводится всегда.
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
  //  - 6.5.0: таймер на каждый хит брал запись без проверки и падал TypeError;
  //  - 6.7.1: счётчик восстанавливается из hitExpirations — следующий хит не
  //    свежий (totalHits > 1).
  // Не провалился ни так, ни так — разбор устарел, его надо перечитать.
  it('контроль: стереть только записи — это не сброс (таймер падает или счётчик живёт)', async () => {
    const lib = new ThrottlerStorageService();
    await hit(lib);
    lib.storage.clear();
    let threw = false;
    let next = 0;
    try {
      jest.advanceTimersByTime(TTL / 2);
      next = (await hit(lib)).totalHits;
    } catch {
      threw = true;
    }
    lib.onApplicationShutdown();
    expect(threw || next > 1).toBe(true);
  });

  it('лимит, исчерпанный до сброса, после сброса не мешает', async () => {
    for (let i = 0; i < 21; i++) await hit(storage);
    expect((await hit(storage)).isBlocked).toBe(true);
    resetMemoryThrottle(storage);
    const after = await hit(storage);
    expect(after.totalHits).toBe(1);
    expect(after.isBlocked).toBe(false);
  });

  it('хиты до сброса не досчитываются к записи, заведённой после', async () => {
    await hit(storage);
    jest.advanceTimersByTime(TTL / 2);
    resetMemoryThrottle(storage);
    await hit(storage);
    // Хит до сброса истёк бы здесь, хит после — ещё нет.
    jest.advanceTimersByTime(TTL / 2 + 100);
    expect((await hit(storage)).totalHits).toBe(2);
  });

  it('сброс снимает таймер выметания; следующий хит заводит его снова', async () => {
    await hit(storage);
    expect(jest.getTimerCount()).toBe(1);
    resetMemoryThrottle(storage);
    expect(jest.getTimerCount()).toBe(0);
    await hit(storage);
    expect(jest.getTimerCount()).toBe(1);
  });

  it('голый ThrottlerStorageService (сборка без гибрида) сбрасывается так же', async () => {
    const lib = new ThrottlerStorageService();
    await hit(lib);
    resetMemoryThrottle(lib);
    expect(lib.storage.size).toBe(0);
    expect((await hit(lib)).totalHits).toBe(1);
    lib.onApplicationShutdown();
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
