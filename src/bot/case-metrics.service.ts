import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CaseMetrics } from './case-metrics.format';

// Счётчики разбора случая для /stats. Свой домен — свой файл (правило №10,
// образец: practice-metrics.service.ts).
//
// Считаем по AnalyticsEvent: у разбора нет собственной таблицы — он
// сохраняется обычной записью дневника режимов, и отличить «запись из
// разбора» от «записи из дневника» в ModeDiaryEntry нельзя. Событие здесь
// единственный честный источник.
//
// «Вернулись за вторым разбором» считаем по людям, а не по событиям: один
// человек с пятью разборами не должен выглядеть как пятеро вернувшихся.
@Injectable()
export class CaseMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<CaseMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);

    const count = (name: string) =>
      this.prisma.analyticsEvent.count({
        where: { name, createdAt: { gte: since30 } },
      });

    // Разрез по одному полю меты: groupBy по JSON Prisma не умеет, поэтому
    // сырой запрос — тот же приём, что у остальных мета-разрезов отчёта.
    const byMetaKey = async (name: string, key: string) => {
      const rows = await this.prisma.$queryRaw<
        Array<{ value: string | null; c: bigint }>
      >`
        SELECT "meta"->>${key} AS value, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = ${name} AND "createdAt" >= ${since30}
        GROUP BY 1`;
      return (v: string) => Number(rows.find((r) => r.value === v)?.c ?? 0);
    };

    const [
      started,
      finished,
      scene,
      verdict,
      recognized,
      named,
      peopleRows,
      returnedRows,
    ] = await Promise.all([
      count('case_started'),
      count('case_finished'),
      byMetaKey('case_scene', 'source'),
      byMetaKey('case_criterion', 'verdict'),
      byMetaKey('case_recognized', 'agreed'),
      byMetaKey('mode_renamed', 'source'),
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(DISTINCT "userId")::bigint AS c FROM "AnalyticsEvent"
        WHERE "name" = 'case_started' AND "createdAt" >= ${since30}`,
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(*)::bigint AS c FROM (
          SELECT "userId" FROM "AnalyticsEvent"
          WHERE "name" = 'case_finished' AND "createdAt" >= ${since30}
          GROUP BY "userId" HAVING count(*) > 1
        ) t`,
    ]);

    return {
      started,
      finished,
      sceneOwn: scene('own'),
      sceneFrame: scene('frame'),
      verdictMode: verdict('mode'),
      verdictOrdinary: verdict('ordinary'),
      verdictBorderline: verdict('borderline'),
      // meta->>'agreed' отдаёт булев JSON как строку 'true'/'false'.
      recognizedAgreed: recognized('true'),
      recognizedDoubted: recognized('false'),
      namedOwn: named('own'),
      namedChip: named('chip'),
      namedSkipped: named('skipped'),
      people: Number(peopleRows[0]?.c ?? 0),
      peopleReturned: Number(returnedRows[0]?.c ?? 0),
    };
  }
}
