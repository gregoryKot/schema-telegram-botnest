import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthHealthMetrics,
  formatAuthHealth,
} from './auth-health-metrics.format';

// Счётчики отказов входа для /stats: события auth_rejected, которые пишет
// TelegramAuthGuard (src/api/auth-failure.report.ts). Свой домен — свой файл
// (правило №10), образец — account-link-metrics.service.ts.
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
    // userId IS NULL — обязательное условие, а не украшение: /api/event
    // открыт авторизованным клиентам, и без этого фильтра любой из них мог бы
    // накрутить отчёт о здоровье входа. Серверные отказы всегда без юзера.
    const [row] = await this.prisma.$queryRaw<
      Array<{
        tg_day: bigint;
        max_day: bigint;
        tg_week: bigint;
        max_week: bigint;
      }>
    >`
      SELECT
        count(*) FILTER (WHERE "meta"->>'host' = 'telegram'
                           AND "createdAt" >= ${since1})::bigint AS tg_day,
        count(*) FILTER (WHERE "meta"->>'host' = 'max'
                           AND "createdAt" >= ${since1})::bigint AS max_day,
        count(*) FILTER (WHERE "meta"->>'host' = 'telegram')::bigint AS tg_week,
        count(*) FILTER (WHERE "meta"->>'host' = 'max')::bigint AS max_week
      FROM "AnalyticsEvent"
      WHERE "name" = 'auth_rejected'
        AND "userId" IS NULL
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
    };
  }
}
