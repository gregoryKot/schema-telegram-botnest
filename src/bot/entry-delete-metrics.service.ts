import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EntryDeleteMetrics,
  formatEntryDeleteMetrics,
} from './entry-delete-metrics.format';

// Счётчики удаления записей архива «Мой путь» для /stats: событие
// entry_deleted из AnalyticsEvent (meta.type — belief_check|letter|flashcard).
// Свой домен — свой файл (правило №10), образец — phrase-check-metrics.service.ts.
@Injectable()
export class EntryDeleteMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatEntryDeleteMetrics(await this.getMetrics());
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
