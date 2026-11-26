import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  sanitizeCrawlerMeta,
  type CrawlerVisitMeta,
} from '../analytics/crawler-visit.meta';
import { CRAWLER_EVENT } from '../analytics/crawler-hits.service';
import {
  CRAWLER_WINDOW_DAYS,
  aggregateCrawlerVisits,
  formatCrawlerMetrics,
  type CrawlerMetrics,
} from './crawler-metrics.format';

const DAY_MS = 86_400_000;

// Счётчики для /stats: событие crawler_visits (заходы роботов нейросетей, раз
// в час с каждого инстанса — src/analytics/crawler-hits.ts). Свой домен — свой
// файл (правило №10).
//
// Без сырого SQL (правило №18): строк не больше «робот × раздел × сайт» в час
// на инстанс, за неделю — сотни; сложить их в коде дешевле, чем заводить
// $queryRaw с живым спеком. Индекс (name, createdAt) отбирает их сразу.
@Injectable()
export class CrawlerMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatCrawlerMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<CrawlerMetrics> {
    // userId: null — строки пишет только сервер. POST /api/event пишет с
    // userId клиента, такие в отчёт не берём; meta сверяется теми же
    // закрытыми списками, что и при записи.
    const rows = await this.prisma.analyticsEvent.findMany({
      where: {
        name: CRAWLER_EVENT,
        userId: null,
        createdAt: { gte: new Date(Date.now() - CRAWLER_WINDOW_DAYS * DAY_MS) },
      },
      select: { meta: true },
    });
    const visits = rows
      .map((r) => sanitizeCrawlerMeta(r.meta))
      .filter((m): m is CrawlerVisitMeta => m !== undefined);
    return aggregateCrawlerVisits(visits);
  }
}
