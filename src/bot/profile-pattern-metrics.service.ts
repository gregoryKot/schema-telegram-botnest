import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProfilePatternMetrics,
  formatProfilePatternMetrics,
} from './profile-pattern-metrics.format';

// Счётчики открытий листа схемы/режима со вкладки «Я» для /stats: событие
// profile_pattern_open из AnalyticsEvent (meta.kind: schema|mode). Свой
// домен — свой файл (правило №10), образец — warm-words-metrics.service.ts.
@Injectable()
export class ProfilePatternMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatProfilePatternMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<ProfilePatternMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.$queryRaw<
      Array<{ kind: string | null; c: bigint }>
    >`
      SELECT "meta"->>'kind' AS kind, count(*)::bigint AS c
      FROM "AnalyticsEvent"
      WHERE "name" = 'profile_pattern_open' AND "createdAt" >= ${since30}
      GROUP BY "meta"->>'kind'`;
    const count = (kind: string): number =>
      Number(rows.find((r) => r.kind === kind)?.c ?? 0n);
    return {
      schemaOpens30: count('schema'),
      modeOpens30: count('mode'),
    };
  }
}
