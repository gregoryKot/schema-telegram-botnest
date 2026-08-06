import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlusMetrics, formatPlusMetrics } from './plus-metrics.format';

// Счётчики универсального меню «плюс» для /stats: события plus_open/
// plus_action/quick_action_toggle из AnalyticsEvent. Свой домен — свой файл
// (правило №10), образец GROUP BY meta — phrase-check-metrics.service.ts.
@Injectable()
export class PlusMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatPlusMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<PlusMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [opensRows, actionRows, hiddenRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ opens: bigint; users: bigint }>>`
        SELECT count(*)::bigint AS opens,
               count(DISTINCT "userId")::bigint AS users
        FROM "AnalyticsEvent"
        WHERE "name" = 'plus_open' AND "createdAt" >= ${since30}`,
      this.prisma.$queryRaw<Array<{ action: string | null; c: bigint }>>`
        SELECT "meta"->>'action' AS action, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'plus_action' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'action'
        ORDER BY c DESC`,
      // Что прячут: quick_action_toggle с hidden=true (jsonb ->> отдаёт
      // булево значение как текст 'true'/'false').
      this.prisma.$queryRaw<Array<{ action: string | null; c: bigint }>>`
        SELECT "meta"->>'action' AS action, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'quick_action_toggle'
          AND "meta"->>'hidden' = 'true'
          AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'action'
        ORDER BY c DESC`,
    ]);
    const [row] = opensRows;
    const toList = (
      rows: Array<{ action: string | null; c: bigint }>,
    ): Array<{ action: string; count: number }> =>
      rows
        .filter((r): r is { action: string; c: bigint } => r.action != null)
        .map((r) => ({ action: r.action, count: Number(r.c) }));
    return {
      opens30: Number(row?.opens ?? 0n),
      users30: Number(row?.users ?? 0n),
      actions30: toList(actionRows),
      hidden30: toList(hiddenRows),
    };
  }
}
