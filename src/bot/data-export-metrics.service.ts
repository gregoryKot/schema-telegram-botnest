import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DataExportMetrics,
  formatDataExportMetrics,
} from './data-export-metrics.format';

const DAY_MS = 86_400_000;

// Счётчики для /stats: событие data_export (человек скачал свои данные,
// GET /api/account/export — право на доступ по 152-ФЗ/GDPR). Свой домен —
// свой файл (правило №10), образец — signup-source-metrics.service.ts.
@Injectable()
export class DataExportMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatDataExportMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<DataExportMetrics> {
    const since30 = new Date(Date.now() - 30 * DAY_MS);
    const [row] = await this.prisma.$queryRaw<
      Array<{
        total: bigint;
        total_users: bigint;
        c30: bigint;
        users30: bigint;
        last_at: Date | null;
      }>
    >`
      SELECT
        count(*)::bigint AS total,
        count(DISTINCT "userId")::bigint AS total_users,
        count(*) FILTER (WHERE "createdAt" >= ${since30})::bigint AS c30,
        count(DISTINCT "userId")
          FILTER (WHERE "createdAt" >= ${since30})::bigint AS users30,
        max("createdAt") AS last_at
      FROM "AnalyticsEvent"
      WHERE "name" = 'data_export'`;
    const lastAt = row?.last_at ? new Date(row.last_at) : null;
    return {
      totalExports: Number(row?.total ?? 0n),
      totalUsers: Number(row?.total_users ?? 0n),
      exports30: Number(row?.c30 ?? 0n),
      users30: Number(row?.users30 ?? 0n),
      daysSinceLast: lastAt
        ? Math.max(0, Math.floor((Date.now() - lastAt.getTime()) / DAY_MS))
        : 0,
    };
  }
}
