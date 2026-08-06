import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountLinkMetrics,
  formatAccountLinkMetrics,
} from './account-link-metrics.format';

// Счётчики переноса аккаунта для /stats: события account_link_* из
// AnalyticsEvent. Свой домен — свой файл (правило №10), образец —
// warm-words-metrics.service.ts.
@Injectable()
export class AccountLinkMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatAccountLinkMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<AccountLinkMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    // Один проход по таблице вместо четырёх: события трёх имён живут рядом,
    // и раскладывать их по колонкам дешевле, чем ходить в БД по разу на счёт.
    const [row] = await this.prisma.$queryRaw<
      Array<{
        started: bigint;
        started_users: bigint;
        confirmed: bigint;
        merged: bigint;
        failed: bigint;
      }>
    >`
      SELECT
        count(*) FILTER (WHERE "name" = 'account_link_started')::bigint AS started,
        count(DISTINCT "userId") FILTER (WHERE "name" = 'account_link_started')::bigint AS started_users,
        count(*) FILTER (WHERE "name" = 'account_link_confirmed')::bigint AS confirmed,
        count(*) FILTER (WHERE "name" = 'account_link_confirmed'
                           AND "meta"->>'merged' = 'true')::bigint AS merged,
        count(*) FILTER (WHERE "name" = 'account_link_failed')::bigint AS failed
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${since30}
        AND "name" IN ('account_link_started', 'account_link_confirmed', 'account_link_failed')`;
    return {
      started30: Number(row?.started ?? 0n),
      startedUsers30: Number(row?.started_users ?? 0n),
      confirmed30: Number(row?.confirmed ?? 0n),
      merged30: Number(row?.merged ?? 0n),
      failed30: Number(row?.failed ?? 0n),
    };
  }
}
