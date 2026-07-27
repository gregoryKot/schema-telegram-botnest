import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeLinkMetrics } from './practice-link-metrics.format';

// Счётчики переходов на сайт практики автора для /stats: событие
// practice_link_click из AnalyticsEvent (анонимное, userId = null — шлёт
// продуктовый лендинг). Свой домен — свой файл (правило №10), образец —
// quiz-metrics.service.ts.
@Injectable()
export class PracticeLinkMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<PracticeLinkMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.$queryRaw<
      Array<{ place: string | null; c: bigint }>
    >`
      SELECT "meta"->>'place' AS place, count(*)::bigint AS c
      FROM "AnalyticsEvent"
      WHERE "name" = 'practice_link_click' AND "createdAt" >= ${since30}
      GROUP BY "meta"->>'place'`;
    const byPlace = (place: string): number =>
      Number(rows.find((r) => r.place === place)?.c ?? 0n);
    return {
      // total — сумма ВСЕХ строк (включая неизвестные place): переход не
      // должен выпасть из итога, даже если мест клика прибавится.
      total30: rows.reduce((sum, r) => sum + Number(r.c), 0),
      author30: byPlace('author'),
      footer30: byPlace('footer'),
      faq30: byPlace('faq'),
      quiz30: byPlace('quiz'),
    };
  }
}
