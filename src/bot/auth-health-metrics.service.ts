import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthHealthMetrics,
  formatAuthHealth,
} from './auth-health-metrics.format';

// Счётчики здоровья входа для /stats: auth_rejected (отказы) и auth_success
// (успехи) — оба пишет только TelegramAuthGuard (src/api/auth-failure.report.ts,
// src/api/auth-success.report.ts). Свой домен — свой файл (правило №10),
// образец — account-link-metrics.service.ts.
@Injectable()
export class AuthHealthMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatAuthHealth(await this.getMetrics());
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
