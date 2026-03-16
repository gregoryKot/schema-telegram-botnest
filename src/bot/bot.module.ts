import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotAnalyticsService } from './bot.analytics.service';

@Module({
  providers: [BotService, BotAnalyticsService],
  exports: [BotService, BotAnalyticsService],
})
export class BotModule {}
