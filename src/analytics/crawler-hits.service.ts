import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { crawlerHits } from './crawler-hits';
import type { CrawlerVisitMeta } from './crawler-visit.meta';

/** Имя события в ANALYTICS_EVENTS (server-events.constants.ts). */
export const CRAWLER_EVENT = 'crawler_visits';

type CounterPort = {
  drain(): CrawlerVisitMeta[];
  absorb(rows: CrawlerVisitMeta[]): void;
};

// Раз в час — счётчики заходов роботов из памяти процесса в AnalyticsEvent
// (crawler-hits.ts). Строка на «робот × раздел × сайт» за час, userId = null:
// /stats считает только такие строки, клиентский POST /api/event пишет со
// своим userId и в отчёт не попадает.
//
// Лидер не нужен (scripts/cron-leader-baseline.json, exempt): каждый инстанс
// сбрасывает только свои заходы; аренда у одного потеряла бы счёт остальных.
@Injectable()
export class CrawlerHitsService {
  private readonly logger = new Logger(CrawlerHitsService.name);
  /** Шов для теста: в проде — общий счётчик процесса из main.ts. */
  counter: CounterPort = crawlerHits;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('7 * * * *')
  async flush(): Promise<void> {
    const rows = this.counter.drain();
    if (rows.length === 0) return;
    try {
      await this.prisma.analyticsEvent.createMany({
        data: rows.map((meta) => ({
          userId: null,
          name: CRAWLER_EVENT,
          meta,
        })),
      });
    } catch (err) {
      // Не потерять час: вернуть в счётчик, уйдёт со следующим сбросом.
      this.counter.absorb(rows);
      this.logger.warn(
        `crawler_visits: сброс не записан (${(err as Error).message}), повтор через час`,
      );
    }
  }
}
