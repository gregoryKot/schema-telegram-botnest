import type { PrismaService } from '../../prisma/prisma.service';
import { PostgresThrottleStorage } from '../../api/postgres-throttle-storage';
import { Probe } from './types';

const KEY = 'selfcheck:probe';

/**
 * Запись+чтение в Postgres-хранилище троттлера (инцидент 2026-09-13: лимит
 * денежных/заявочных ручек считался в памяти процесса и обходился ротацией
 * инстанса — src/api/postgres-throttle-storage.ts). Переиспользует настоящий
 * сервис, не новый SQL: increment() — единственная точка записи/чтения.
 */
export function throttleStorageProbe(prisma: PrismaService): Probe {
  return {
    id: 'throttleStorage',
    title: 'Хранилище лимитов запросов (Postgres)',
    critical: false,
    async run() {
      try {
        const storage = new PostgresThrottleStorage(prisma);
        const rec = await storage.increment(KEY, 5_000, 1_000_000, 0);
        return rec.totalHits >= 1
          ? { ok: true, detail: 'запись и чтение прошли' }
          : { ok: false, detail: 'запись прошла, но счётчик не увеличился' };
      } catch (e) {
        return {
          ok: false,
          detail: (e as Error)?.message?.slice(0, 200) ?? 'не отвечает',
        };
      }
    },
  };
}
