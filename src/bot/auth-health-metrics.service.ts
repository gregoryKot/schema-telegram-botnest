import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatAuthHealth } from './auth-health-metrics.format';
import {
  parseAuthHealthRows,
  type AuthHealthMetrics,
  type AuthHealthRow,
} from './auth-health-rows';
import {
  formatLaunchPlatforms,
  type LaunchPlatformRow,
} from './launch-platform-metrics.format';

// Счётчики здоровья входа для /stats: обмен подписи на сессию прошёл / не
// прошёл (messenger_launch / messenger_launch_failed — ручки обмена, разбор и
// причины — auth-health-rows.ts) и пустая подпись старых окон мини-аппа
// (auth_rejected, src/api/auth-failure.report.ts). Свой домен — свой файл.
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
    // userId IS NULL — обязательное условие, а не украшение: /api/event открыт
    // авторизованным клиентам, и без него любой мог бы накрутить отчёт о
    // здоровье входа в любую сторону. Все три события пишет только сервер
    // (ручки обмена и guard), всегда без userId.
    const rows = await this.prisma.$queryRaw<AuthHealthRow[]>`
      SELECT "name", "meta"->>'host' AS host, "meta"->>'reason' AS reason,
        count(*) FILTER (WHERE "createdAt" >= ${since1})::bigint AS day,
        count(*)::bigint AS week
      FROM "AnalyticsEvent"
      WHERE "userId" IS NULL
        AND "name" IN ('messenger_launch', 'messenger_launch_failed', 'auth_rejected')
        AND "createdAt" >= ${since7}
      GROUP BY "name", "meta"->>'host', "meta"->>'reason'`;
    return parseAuthHealthRows(rows);
  }
}
