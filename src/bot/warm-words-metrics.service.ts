import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WarmWordsMetrics,
  formatWarmWordsMetrics,
} from './warm-words-metrics.format';

// Счётчики открытий «Тёплых слов» для /stats: событие warm_words_open
// из AnalyticsEvent (без обязательного meta). Свой домен — свой файл
// (правило №10), образец — mode-card-metrics.service.ts.
@Injectable()
export class WarmWordsMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatWarmWordsMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<WarmWordsMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [row] = await this.prisma.$queryRaw<
      Array<{ opens: bigint; users: bigint }>
    >`
      SELECT count(*)::bigint AS opens,
             count(DISTINCT "userId")::bigint AS users
      FROM "AnalyticsEvent"
      WHERE "name" = 'warm_words_open' AND "createdAt" >= ${since30}`;
    return {
      opens30: Number(row?.opens ?? 0n),
      users30: Number(row?.users ?? 0n),
    };
  }
}
