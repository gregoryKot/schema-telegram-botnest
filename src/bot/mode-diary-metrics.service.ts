import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ModeDiaryMetrics,
  formatModeDiaryMetrics,
} from './mode-diary-metrics.format';

// Счётчики дневника режимов для /stats: события mode_entry_saved (записи +
// ответ Здорового Взрослого), mode_test_completed (тест «по функции»),
// mode_chain_followup (разобрал связанный режим после записи) и
// mode_doubt_opened/mode_doubt_switched (сравнил похожие режимы карточкой
// «Сомневаешься?», возможно поменял выбор). Свой домен — свой файл
// (правило №10), образец — mode-card-metrics.service.ts. НЕ в
// ProductMetricsService — тот зафиксирован на 257 строках (см. комментарий
// в stats-report.service.ts).
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

    const [doubtRow] = await this.prisma.$queryRaw<
      Array<{ doubtOpened30: bigint; doubtSwitched30: bigint }>
    >`
      SELECT
        count(*) FILTER (WHERE "name" = 'mode_doubt_opened')::bigint AS "doubtOpened30",
        count(*) FILTER (WHERE "name" = 'mode_doubt_switched')::bigint AS "doubtSwitched30"
      FROM "AnalyticsEvent"
      WHERE "name" IN ('mode_doubt_opened', 'mode_doubt_switched')
        AND "createdAt" >= ${since30}`;

    return {
      saves7: Number(entryRow?.saves7 ?? 0n),
      saves30: Number(entryRow?.saves30 ?? 0n),
      withHealthy30: Number(entryRow?.withHealthy30 ?? 0n),
      testCompleted7: Number(testRow?.testCompleted7 ?? 0n),
      testCompleted30: Number(testRow?.testCompleted30 ?? 0n),
      chainAccepted30: Number(chainRow?.chainAccepted30 ?? 0n),
      doubtOpened30: Number(doubtRow?.doubtOpened30 ?? 0n),
      doubtSwitched30: Number(doubtRow?.doubtSwitched30 ?? 0n),
    };
  }
}
