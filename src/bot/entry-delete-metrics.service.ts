import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EntryDeleteMetrics,
  formatEntryDeleteMetrics,
  YsqDeleteMetrics,
} from './entry-delete-metrics.format';

// Счётчики удаления записей архива «Мой путь» для /stats: событие
// entry_deleted из AnalyticsEvent (meta.type — belief_check|letter|flashcard)
// и ysq_data_deleted (стёртый целиком тест схем).
// Свой домен — свой файл (правило №10), образец — phrase-check-metrics.service.ts.
@Injectable()
export class EntryDeleteMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    const [m, ysq] = await Promise.all([this.getMetrics(), this.getYsq()]);
    return formatEntryDeleteMetrics(m, ysq);
  }

  /** «Удалить результаты теста» за месяц. attempts пишет только
   *  DELETE /api/ysq-data (sanitizeMeta отбрасывает его с клиента) — строка
   *  без него подделка через /api/event, её не считаем. */
  async getYsq(): Promise<YsqDeleteMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [row] = await this.prisma.$queryRaw<
      Array<{ deleted: bigint; users: bigint; completed: bigint }>
    >`
      SELECT count(*)::bigint AS deleted,
             count(DISTINCT "userId")::bigint AS users,
             count(DISTINCT "userId")
               FILTER (WHERE ("meta"->>'attempts')::int > 0)::bigint AS completed
      FROM "AnalyticsEvent"
      WHERE "name" = 'ysq_data_deleted' AND "createdAt" >= ${since30}
        AND "meta"->>'attempts' IS NOT NULL`;
    return {
      deleted30: Number(row?.deleted ?? 0n),
      users30: Number(row?.users ?? 0n),
      completedUsers30: Number(row?.completed ?? 0n),
    };
  }

  async getMetrics(): Promise<EntryDeleteMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [totals, typeRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ deleted: bigint; users: bigint }>>`
        SELECT count(*)::bigint AS deleted,
               count(DISTINCT "userId")::bigint AS users
        FROM "AnalyticsEvent"
        WHERE "name" = 'entry_deleted' AND "createdAt" >= ${since30}`,
      this.prisma.$queryRaw<Array<{ type: string; c: bigint }>>`
        SELECT "meta"->>'type' AS type, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'entry_deleted' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'type'
        ORDER BY c DESC`,
    ]);
    const row = totals[0];
    return {
      deleted30: Number(row?.deleted ?? 0n),
      users30: Number(row?.users ?? 0n),
      byType30: typeRows
        .filter((r) => r.type !== null)
        .map((r) => ({ type: r.type, count: Number(r.c) })),
    };
  }
}
