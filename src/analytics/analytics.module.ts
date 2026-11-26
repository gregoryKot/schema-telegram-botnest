import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CrawlerHitsService } from './crawler-hits.service';
import { AdminAnalyticsModule } from './admin/admin-analytics.module';

@Module({
  imports: [AdminAnalyticsModule],
  providers: [AnalyticsService, CrawlerHitsService],
  exports: [AnalyticsService, AdminAnalyticsModule],
})
export class AnalyticsModule {}
