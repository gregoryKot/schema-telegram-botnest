import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import type { SearchResultKind } from '../analytics/cabinet-events.constants';
import {
  formatSearchMetrics,
  type SearchMetrics,
} from './search-metrics.format';

const EVENT: AnalyticsEventName = 'search_result_open';

// Что открывают из общего поиска, для /stats (событие search_result_open, смысл —
// src/analytics/cabinet-events.constants.ts). Без сырого SQL: count через Prisma, разрез
// по meta — фильтром пути. Образец — task-assign-metrics.service.ts.
@Injectable()
export class SearchMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatSearchMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<SearchMetrics> {
    const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
    const count = (path: string, equals: SearchResultKind | boolean) =>
      this.prisma.analyticsEvent.count({
        where: { name: EVENT, createdAt, meta: { path: [path], equals } },
      });
    const [clients30, sections30, guide30, actions30, typed30, recent30] =
      await Promise.all([
        count('kind', 'client'),
        count('kind', 'section'),
        count('kind', 'guide'),
        count('kind', 'action'),
        count('typed', true),
        count('recent', true),
      ]);
    return { clients30, sections30, guide30, actions30, typed30, recent30 };
  }
}
