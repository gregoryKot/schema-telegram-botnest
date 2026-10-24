import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ThrottleStorageRecord } from './throttle-storage-record';

interface ThrottleHitRow {
  hits: number;
  expiresAt: Date;
  blockedUntil: Date | null;
}

/**
 * Счётчик троттлинга в Postgres (инцидент 2026-09-13): на двух инстансах
 * Amvera счётчик @nestjs/throttler в памяти процесса не общий, и лимит
 * денежных/заявочных ручек обходился ротацией инстанса.
 *
 * ОДИН атомарный `$queryRaw`: INSERT … ON CONFLICT (key) DO UPDATE с CASE
 * прямо на строке `t` — не «SELECT, потом решить в JS, потом UPDATE»: под
 * конкурентной нагрузкой такой SELECT читает уже устаревшую строку, а
 * ON CONFLICT DO UPDATE берёт блокировку конфликтующей строки ДО вычисления
 * SET-выражений — это и даёт атомарность (свойство Postgres, доказано на
 * живой базе, не мок: test/throttle-storage.e2e-spec.ts, правило №18).
 *
 * Фиксированное окно (не скользящее: «последние N секунд»), как и было в
 * штатном ThrottlerStorageService библиотеки — осознанный компромисс:
 * скользящее окно (лог таймстампов/sorted set) точнее, но не нужно для
 * лимита в 6-20 запросов/час на горстке ручек.
 *
 * Три состояния строки, как в штатном ThrottlerStorageService.increment()
 * (throttler.service.js): (1) блок ещё держится — ничего не меняем; (2) блок
 * только что истёк — ПОЛНЫЙ сброс (hits=1, новое окно), НЕЗАВИСИМО от того,
 * истекло ли само окно — resetBlockdRequest() библиотеки делает это
 * безусловно; (3) блока нет — обычная логика окна (истекло → новое окно,
 * иначе +1 к счётчику). Смешение (2) и (3) в одну ветку — баг, найденный
 * тестом «блок истёк — счётчик сброшен»: без отдельной ветки (2) сброс блока
 * при ещё живом окне продолжал копить hits дальше лимита и блокировал снова.
 */
@Injectable()
export class PostgresThrottleStorage {
  constructor(private readonly prisma: PrismaService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottleStorageRecord> {
    const now = new Date();
    const expiresAtNew = new Date(now.getTime() + ttl);
    const blockedUntilNew = new Date(now.getTime() + blockDuration);

    const rows = await this.prisma.$queryRaw<ThrottleHitRow[]>`
      INSERT INTO "ThrottleHit" AS t (key, hits, "expiresAt", "blockedUntil")
      VALUES (${key}, 1, ${expiresAtNew}, NULL)
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE
          WHEN t."blockedUntil" IS NOT NULL AND t."blockedUntil" > ${now}
            THEN t.hits
          WHEN t."blockedUntil" IS NOT NULL THEN 1
          WHEN t."expiresAt" <= ${now} THEN 1
          ELSE t.hits + 1
        END,
        "expiresAt" = CASE
          WHEN t."blockedUntil" IS NOT NULL AND t."blockedUntil" > ${now}
            THEN t."expiresAt"
          WHEN t."blockedUntil" IS NOT NULL THEN ${expiresAtNew}
          WHEN t."expiresAt" <= ${now} THEN ${expiresAtNew}
          ELSE t."expiresAt"
        END,
        "blockedUntil" = CASE
          WHEN t."blockedUntil" IS NOT NULL AND t."blockedUntil" > ${now}
            THEN t."blockedUntil"
          WHEN (
            CASE
              WHEN t."blockedUntil" IS NOT NULL THEN 1
              WHEN t."expiresAt" <= ${now} THEN 1
              ELSE t.hits + 1
            END
          ) > ${limit} THEN ${blockedUntilNew}
          ELSE NULL
        END
      RETURNING hits, "expiresAt", "blockedUntil"
    `;
    return toRecord(rows[0], now);
  }
}

function toRecord(row: ThrottleHitRow, now: Date): ThrottleStorageRecord {
  const blocked = row.blockedUntil !== null && row.blockedUntil > now;
  const toSeconds = (t: Date) =>
    Math.max(0, Math.ceil((t.getTime() - now.getTime()) / 1000));
  return {
    totalHits: row.hits,
    timeToExpire: toSeconds(row.expiresAt),
    isBlocked: blocked,
    timeToBlockExpire: blocked ? toSeconds(row.blockedUntil as Date) : 0,
  };
}
