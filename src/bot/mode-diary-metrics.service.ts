import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ModeDiaryMetrics,
  formatModeDiaryMetrics,
} from './mode-diary-metrics.format';

// Счётчики дневника режимов для /stats: события mode_entry_saved (записи +
// ответ Здорового Взрослого), mode_test_completed (тест «по функции») и
// mode_chain_followup (разобрал связанный режим после записи). Свой домен —
// свой файл (правило №10), образец — mode-card-metrics.service.ts.
@Injectable()
export class ModeDiaryMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatModeDiaryMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<ModeDiaryMetrics> {
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const since30 = new Date(Date.now() - 30 * 86_400_000);

    const [entryRow] = await this.prisma.$queryRaw<
      Array<{ saves7: bigint; saves30: bigint; withHealthy30: bigint }>
    >`
      SELECT
        count(*) FILTER (WHERE "createdAt" >= ${since7})::bigint AS "saves7",
        count(*)::bigint AS "saves30",
        count(*) FILTER (
          WHERE ("meta"->>'filledHealthy') = 'true'
        )::bigint AS "withHealthy30"
      FROM "AnalyticsEvent"
      WHERE "name" = 'mode_entry_saved' AND "createdAt" >= ${since30}`;

    const [testRow] = await this.prisma.$queryRaw<
      Array<{ testCompleted7: bigint; testCompleted30: bigint }>
    >`
      SELECT
        count(*) FILTER (WHERE "createdAt" >= ${since7})::bigint AS "testCompleted7",
        count(*)::bigint AS "testCompleted30"
      FROM "AnalyticsEvent"
      WHERE "name" = 'mode_test_completed' AND "createdAt" >= ${since30}`;

    const [chainRow] = await this.prisma.$queryRaw<
      Array<{ chainAccepted30: bigint }>
    >`
      SELECT count(*)::bigint AS "chainAccepted30"
      FROM "AnalyticsEvent"
      WHERE "name" = 'mode_chain_followup' AND "createdAt" >= ${since30}`;

    return {
      saves7: Number(entryRow?.saves7 ?? 0n),
      saves30: Number(entryRow?.saves30 ?? 0n),
      withHealthy30: Number(entryRow?.withHealthy30 ?? 0n),
      testCompleted7: Number(testRow?.testCompleted7 ?? 0n),
      testCompleted30: Number(testRow?.testCompleted30 ?? 0n),
      chainAccepted30: Number(chainRow?.chainAccepted30 ?? 0n),
    };
  }
}
