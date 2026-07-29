import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ModeCardMetrics,
  formatModeCardMetrics,
} from './mode-card-metrics.format';

// Счётчики сохранений карточки режима для /stats: событие mode_card_saved
// из AnalyticsEvent (meta.modeId + meta.filledFields). Свой домен — свой
// файл (правило №10), образец — quiz-metrics.service.ts. Подклеивается к
// /stats самим telegram.service.ts (как pool status), не через
// ProductMetricsService — тот держим на зафиксированном размере.
@Injectable()
export class ModeCardMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatModeCardMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<ModeCardMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [row] = await this.prisma.$queryRaw<
      Array<{ saved: bigint; users: bigint; avgFilled: number | null }>
    >`
      SELECT count(*)::bigint AS saved,
             count(DISTINCT "userId")::bigint AS users,
             AVG(("meta"->>'filledFields')::numeric) AS "avgFilled"
      FROM "AnalyticsEvent"
      WHERE "name" = 'mode_card_saved' AND "createdAt" >= ${since30}`;
    return {
      saved30: Number(row?.saved ?? 0n),
      users30: Number(row?.users ?? 0n),
      avgFilled30: Number(row?.avgFilled ?? 0),
    };
  }
}
