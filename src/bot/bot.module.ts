import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotAnalyticsService } from './bot.analytics.service';
import { DiaryService } from './diary.service';

@Module({
  providers: [BotService, BotAnalyticsService, DiaryService],
  exports: [BotService, BotAnalyticsService, DiaryService],
})
export class BotModule {}
