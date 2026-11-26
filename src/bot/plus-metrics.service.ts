import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlusMetrics, formatPlusMetrics } from './plus-metrics.format';

// Счётчики универсального меню «плюс» для /stats: события
// quick_action_toggle/quick_action_move из AnalyticsEvent. Свой домен — свой файл
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
    const [hiddenRows, movesRows] = await Promise.all([
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
      // Переупорядочивание — без разбивки по пункту, только общий счётчик.
      this.prisma.$queryRaw<Array<{ moves: bigint }>>`
        SELECT count(*)::bigint AS moves
        FROM "AnalyticsEvent"
        WHERE "name" = 'quick_action_move' AND "createdAt" >= ${since30}`,
    ]);
    const [moveRow] = movesRows;
    const toList = (
      rows: Array<{ action: string | null; c: bigint }>,
    ): Array<{ action: string; count: number }> =>
      rows
        .filter((r): r is { action: string; c: bigint } => r.action != null)
        .map((r) => ({ action: r.action, count: Number(r.c) }));
    return {
      hidden30: toList(hiddenRows),
      moves30: Number(moveRow?.moves ?? 0n),
    };
  }
}
