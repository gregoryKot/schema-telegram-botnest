import { Module } from '@nestjs/common';
import { AdminAnalyticsQueries } from './admin-analytics.queries';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  providers: [AdminAnalyticsQueries, AdminAnalyticsService],
  exports: [AdminAnalyticsService],
})
export class AdminAnalyticsModule {}
