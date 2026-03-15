import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { TELEGRAM_PROVIDERS } from './telegram.providers';
import { BotModule } from '../bot/bot.module';
import { ChartService } from '../chart/chart.service';

@Module({
  imports: [BotModule],
  providers: [TelegramService, TelegramScheduleService, ChartService, ...TELEGRAM_PROVIDERS],
  exports: [TelegramService],
})
export class TelegramModule {}
