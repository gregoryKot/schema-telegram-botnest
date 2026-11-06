import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CrawlerHitsService } from './crawler-hits.service';

// Продуктовая аналитика. PrismaModule глобальный — PrismaService инжектится
// напрямую, отдельно регистрировать не нужно (правило «не дублируй провайдеры»).
@Module({
  providers: [AnalyticsService, CrawlerHitsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
