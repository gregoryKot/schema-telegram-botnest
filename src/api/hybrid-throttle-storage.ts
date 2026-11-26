import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import {
  type ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { PostgresThrottleStorage } from './postgres-throttle-storage';
import type { ThrottleStorageRecord } from './throttle-storage-record';

const DB_PREFIX = 'db:';

/**
 * Маршрутизация по префиксу ключа (сам префикс ставит
 * UserThrottlerGuard.generateKey по метке `@PersistentThrottle()`):
 * `db:`-ключи — денежные/заявочные ручки — считает Postgres, счётчик общий
 * на оба инстанса Amvera; остальные — штатное `ThrottlerStorageService` в
 * памяти процесса (своё жило до 6.7.1, сверка — hybrid-throttle-storage.spec.ts).
 * Так не грузим БД записью на КАЖДЫЙ запрос сайта, только на ручки, где дубль
 * обхода стоит денег/спама.
 *
 * Деградация: Postgres недоступен → ЭТА ОДНА проверка на время запроса
 * считается в памяти (лучше временно ослабленный на два инстанса лимит, чем
 * 500 пользователю). `warn`, не `error`: `error` ушёл бы в AlertLogger и
 * будил админа DM на каждый запрос, пока авария БД не починится — сама
 * авария уже алертится отдельно (DbOutageMonitorService).
 *
 * Остановка: таймер выметания у памяти один (не на хит, как в 6.5.0 — PR #492
 * повис на 47 минут); хук снимает его, шов — *.shutdown.spec.ts.
 */
export class HybridThrottleStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly logger = new Logger(HybridThrottleStorage.name);
  private readonly memory = new ThrottlerStorageService();
  private readonly postgres: PostgresThrottleStorage;

  constructor(prisma: PrismaService) {
    this.postgres = new PostgresThrottleStorage(prisma);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottleStorageRecord> {
    const args = [key, ttl, limit, blockDuration, throttlerName] as const;
    if (!key.startsWith(DB_PREFIX)) return this.memory.increment(...args);
    try {
      return await this.postgres.increment(key, ttl, limit, blockDuration);
    } catch (err) {
      this.logger.warn(
        `Postgres-хранилище троттлинга недоступно, ключ временно считается в ` +
          `памяти: ${(err as Error)?.message?.slice(0, 120)}`,
      );
      return this.memory.increment(...args);
    }
  }

  onApplicationShutdown(): void {
    this.memory.onApplicationShutdown();
  }
}
