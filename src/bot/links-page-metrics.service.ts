import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LINKS_PAGE_FROM,
  LINKS_PAGE_TARGETS,
} from '../analytics/links-page.constants';
import { LinksPageMetrics } from './links-page-metrics.format';

const count = (
  keys: readonly string[],
  values: unknown[],
): Record<string, number> =>
  Object.fromEntries(
    keys.map((k) => [k, values.filter((v) => v === k).length]),
  );

// Нажатия кнопок страницы ссылок для /stats: событие links_page_click из
// AnalyticsEvent (анонимное). Строк мало (одна страница, клики гостей), поэтому
// разбивка по meta считается в памяти, без сырого SQL.
@Injectable()
export class LinksPageMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<LinksPageMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.analyticsEvent.findMany({
      where: { name: 'links_page_click', createdAt: { gte: since30 } },
      select: { meta: true },
    });
    const field = (key: string): unknown[] =>
      rows.map((r) =>
        r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta)
          ? r.meta[key]
          : undefined,
      );
    return {
      total30: rows.length,
      byTarget: count(LINKS_PAGE_TARGETS, field('target')),
      byFrom: count(LINKS_PAGE_FROM, field('from')),
    };
  }
}
