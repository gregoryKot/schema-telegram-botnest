import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthHealthMetrics,
  formatAuthHealth,
} from './auth-health-metrics.format';
import {
  formatLaunchPlatforms,
  type LaunchPlatformRow,
} from './launch-platform-metrics.format';

// Счётчики здоровья входа для /stats: auth_rejected (отказы) и auth_success
// (успехи) — оба пишет только TelegramAuthGuard (src/api/auth-failure.report.ts,
// src/api/auth-success.report.ts); messenger_launch (запуски по платформам) —
// ручки обмена подписи. Свой домен — свой файл (правило №10).
@Injectable()
export class AuthHealthMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    const [m, launches] = await Promise.all([
      this.getMetrics(),
      this.getLaunches(),
    ]);
    return `${formatAuthHealth(m)}\n${formatLaunchPlatforms(launches)}`;
  }

  /** Запуски в мессенджере по площадке и платформе: эта неделя и прошлая.
   *  userId IS NULL — по той же причине, что ниже: messenger_launch пишет
   *  только ручка обмена подписи, без userId (подделке с клиента не верим). */
  async getLaunches(): Promise<LaunchPlatformRow[]> {
    const now = Date.now();
    const since7 = new Date(now - 7 * 86_400_000);
    const since14 = new Date(now - 14 * 86_400_000);
    const rows = await this.prisma.$queryRaw<
      Array<{
        host: string | null;
        platform: string | null;
        week: bigint;
        prev: bigint;
      }>
    >`
      SELECT "meta"->>'host' AS host, "meta"->>'platform' AS platform,
        count(*) FILTER (WHERE "createdAt" >= ${since7})::bigint AS week,
        count(*) FILTER (WHERE "createdAt" < ${since7})::bigint AS prev
      FROM "AnalyticsEvent"
      WHERE "userId" IS NULL
        AND "name" = 'messenger_launch'
        AND "createdAt" >= ${since14}
      GROUP BY 1, 2`;
    return rows
      .filter((r) => r.host !== null && r.platform !== null)
      .map((r) => ({
        host: r.host as string,
        platform: r.platform as string,
        week: Number(r.week),
        prevWeek: Number(r.prev),
      }));
  }

  async getMetrics(): Promise<AuthHealthMetrics> {
    const now = Date.now();
    const since7 = new Date(now - 7 * 86_400_000);
    const since1 = new Date(now - 86_400_000);
    // userId IS NULL — обязательное условие для ОБОИХ событий, а не украшение:
    // /api/event открыт авторизованным клиентам, и без этого фильтра любой
    // из них мог бы накрутить отчёт о здоровье входа (в свою пользу — раздув
    // либо отказы, либо успехи). Оба события пишет только guard, всегда без
    // userId.
    const [row] = await this.prisma.$queryRaw<
      Array<{
        tg_day: bigint;
        max_day: bigint;
        tg_week: bigint;
        max_week: bigint;
        success_day: bigint;
        success_week: bigint;
      }>
    >`
      SELECT
        count(*) FILTER (WHERE "name" = 'auth_rejected'
                           AND "meta"->>'host' = 'telegram'
                           AND "createdAt" >= ${since1})::bigint AS tg_day,
        count(*) FILTER (WHERE "name" = 'auth_rejected'
                           AND "meta"->>'host' = 'max'
                           AND "createdAt" >= ${since1})::bigint AS max_day,
        count(*) FILTER (WHERE "name" = 'auth_rejected'
                           AND "meta"->>'host' = 'telegram')::bigint AS tg_week,
        count(*) FILTER (WHERE "name" = 'auth_rejected'
                           AND "meta"->>'host' = 'max')::bigint AS max_week,
        count(*) FILTER (WHERE "name" = 'auth_success'
                           AND "createdAt" >= ${since1})::bigint AS success_day,
        count(*) FILTER (WHERE "name" = 'auth_success')::bigint AS success_week
      FROM "AnalyticsEvent"
      WHERE "userId" IS NULL
        AND "name" IN ('auth_rejected', 'auth_success')
        AND "createdAt" >= ${since7}`;
    return {
      day: {
        telegram: Number(row?.tg_day ?? 0n),
        max: Number(row?.max_day ?? 0n),
      },
      week: {
        telegram: Number(row?.tg_week ?? 0n),
        max: Number(row?.max_week ?? 0n),
      },
      successDay: Number(row?.success_day ?? 0n),
      successWeek: Number(row?.success_week ?? 0n),
    };
  }
}
