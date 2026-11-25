import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DiaryJumpMetrics,
  formatDiaryJumpMetrics,
} from './diary-jump-metrics.format';

// Переходы из вкладки «Записи» для /stats: событие diary_jump из
// AnalyticsEvent (meta.to: pattern|tracker|case). Образец — profile-pattern-metrics.
@Injectable()
export class DiaryJumpMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatDiaryJumpMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<DiaryJumpMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.$queryRaw<
      Array<{ to: string | null; c: bigint }>
    >`
      SELECT "meta"->>'to' AS "to", count(*)::bigint AS c
      FROM "AnalyticsEvent"
      WHERE "name" = 'diary_jump' AND "createdAt" >= ${since30}
      GROUP BY "meta"->>'to'`;
    const count = (to: string): number =>
      Number(rows.find((r) => r.to === to)?.c ?? 0n);
    return {
      pattern30: count('pattern'),
      tracker30: count('tracker'),
      case30: count('case'),
    };
  }
}
