import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import {
  SEARCH_RESULT_KINDS,
  type SearchResultKind,
} from '../analytics/cabinet-events.constants';
import {
  formatSearchMetrics,
  type SearchMetrics,
} from './search-metrics.format';

const EVENT: AnalyticsEventName = 'search_result_open';

// Что открывают из общего поиска, для /stats (событие search_result_open). Без сырого SQL:
// count через Prisma, разрез по meta — фильтром пути, как в task-assign-metrics.service.ts.
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
    const byKind30 = {} as Record<SearchResultKind, number>;
    for (const k of SEARCH_RESULT_KINDS) byKind30[k] = await count('kind', k);
    return {
      byKind30,
      typed30: await count('typed', true),
      recent30: await count('recent', true),
    };
  }
}
