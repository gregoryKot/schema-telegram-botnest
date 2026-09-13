import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { PostgresThrottleStorage } from './postgres-throttle-storage';
import type { ThrottleStorageRecord } from './throttle-storage-record';

const DB_PREFIX = 'db:';

/**
 * Маршрутизация по префиксу ключа (сам префикс ставит
 * UserThrottlerGuard.generateKey по метке `@PersistentThrottle()`):
 * `db:`-ключи — денежные/заявочные ручки — считает Postgres, счётчик общий
 * на оба инстанса Amvera; остальные — штатное хранилище библиотеки в памяти
 * процесса, как было. Так не грузим БД лишней записью на КАЖДЫЙ запрос
 * сайта — только на горстку ручек, где дубль обхода стоит денег/спама.
 *
 * Деградация: Postgres недоступен → ЭТА ОДНА проверка на время запроса
 * считается в памяти (лучше временно ослабленный на два инстанса лимит, чем
 * 500 пользователю). `warn`, не `error`: `error` ушёл бы в AlertLogger и
 * будил админа DM на каждый запрос, пока авария БД не починится — сама
 * авария уже алертится отдельно (DbOutageMonitorService).
 */
export class HybridThrottleStorage implements ThrottlerStorage {
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
    if (!key.startsWith(DB_PREFIX)) {
      return this.memory.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
    try {
      return await this.postgres.increment(key, ttl, limit, blockDuration);
    } catch (err) {
      this.logger.warn(
        `Postgres-хранилище троттлинга недоступно, ключ временно считается в ` +
          `памяти: ${(err as Error)?.message?.slice(0, 120)}`,
      );
      return this.memory.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }
}
