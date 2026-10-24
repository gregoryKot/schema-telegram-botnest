import type { OnApplicationShutdown } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottleStorageRecord } from './throttle-storage-record';

/** Как часто (мс) выметаются записи, у которых не осталось ни хитов, ни блока. */
export const SWEEP_MS = 60_000;

interface Entry {
  /** Моменты истечения живых хитов (мс, по возрастанию: ttl ключа постоянен). */
  hits: number[];
  /** Конец окна — только для `timeToExpire` в заголовках ответа. */
  expiresAt: number;
  blockExpiresAt: number;
  isBlocked: boolean;
}

/**
 * Счётчик троттлинга в памяти процесса — для всех ключей без `db:`.
 *
 * Заменяет штатный ThrottlerStorageService (@nestjs/throttler 6.5.0), у
 * которого два дефекта (разбор аудита 2026-10-11; в 6.6.0/6.7.0 оба починены,
 * замена не обязательна — возврат на штатное: docs/open/backend.md):
 *  1. таймер истечения ставится на каждый хит, а `resetBlockdRequest` при
 *     снятии блока ОДНОГО клиента отменяет таймеры по имени троттлера
 *     (`short`/`long`), то есть у всех остальных ключей. Их хиты перестают
 *     вычитаться, честный клиент ловит 429 раньше лимита; блок снимается — и
 *     всё повторяется каскадом;
 *  2. записи из Map не удаляются никогда.
 *
 * Здесь таймеров нет вообще: хит хранится как момент своего истечения и
 * вычитается по часам при следующем обращении к ЭТОМУ ключу, чужие ключи
 * друг на друга не влияют. Порядок шагов `increment` повторяет библиотеку
 * (скользящее окно по хитам, блок на `blockDuration`, сброс ключа при
 * истечении блока, формулы `timeToExpire`/`timeToBlockExpire`), чтобы лимиты
 * `short`/`long` и заголовки Retry-After не изменились; это пинит
 * дифференциальный тест в memory-throttle-storage.spec.ts.
 *
 * Ключ уже содержит имя троттлера (ThrottlerGuard.generateKey): одна запись =
 * один троттлер. Раз в SWEEP_MS обращение заодно выметает мёртвые записи.
 */
export class MemoryThrottleStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly entries = new Map<string, Entry>();
  private sweptAt = Date.now();

  get size(): number {
    return this.entries.size;
  }

  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottleStorageRecord> {
    const now = Date.now();
    this.sweep(now);

    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        hits: [],
        expiresAt: now + ttl,
        blockExpiresAt: 0,
        isBlocked: false,
      };
      this.entries.set(key, entry);
    }
    dropExpiredHits(entry, now);

    if (entry.expiresAt <= now) entry.expiresAt = now + ttl;
    const timeToExpire = Math.ceil((entry.expiresAt - now) / 1000);

    if (!entry.isBlocked) entry.hits.push(now + ttl);

    if (entry.hits.length > limit && !entry.isBlocked) {
      entry.isBlocked = true;
      entry.blockExpiresAt = now + blockDuration;
    }

    // Отрицательное значение у незаблокированного ключа — как в библиотеке:
    // ThrottlerGuard читает его только при isBlocked.
    const timeToBlockExpire = Math.ceil((entry.blockExpiresAt - now) / 1000);
    if (timeToBlockExpire <= 0 && entry.isBlocked) {
      entry.isBlocked = false;
      entry.hits = [now + ttl];
    }

    return Promise.resolve({
      totalHits: entry.hits.length,
      timeToExpire,
      isBlocked: entry.isBlocked,
      timeToBlockExpire,
    });
  }

  /** Стирает все счётчики (тестовый сброс между сценариями одного файла). */
  reset(): void {
    this.entries.clear();
  }

  /** Таймеров нет, останавливать нечего; хук оставлен ради шва DI. */
  onApplicationShutdown(): void {
    // намеренно пусто
  }

  private sweep(now: number): void {
    if (now - this.sweptAt < SWEEP_MS) return;
    this.sweptAt = now;
    for (const [key, entry] of this.entries) {
      dropExpiredHits(entry, now);
      const blocked = entry.isBlocked && entry.blockExpiresAt > now;
      const alive = entry.hits.length > 0 || entry.expiresAt > now || blocked;
      if (!alive) this.entries.delete(key);
    }
  }
}

function dropExpiredHits(entry: Entry, now: number): void {
  let expired = 0;
  while (expired < entry.hits.length && entry.hits[expired] <= now) expired++;
  if (expired > 0) entry.hits.splice(0, expired);
}
