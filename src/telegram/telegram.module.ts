import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramFaqService } from './telegram.faq.service';
import { TelegramRatingService } from './telegram.rating.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { TelegramSettingsService } from './telegram.settings.service';
import { TELEGRAM_PROVIDERS } from './telegram.providers';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [BotModule],
  providers: [TelegramService, TelegramFaqService, TelegramRatingService, TelegramScheduleService, TelegramSettingsService, ...TELEGRAM_PROVIDERS],
  exports: [TelegramService],
})
export class TelegramModule {}
