import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotAnalyticsService } from './bot.analytics.service';
import { DiaryService } from './diary.service';
import { ProfileService } from './profile.service';

@Module({
  providers: [BotService, BotAnalyticsService, DiaryService, ProfileService],
  exports: [BotService, BotAnalyticsService, DiaryService, ProfileService],
})
export class BotModule {}
