import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TELEGRAM_PROVIDERS } from './telegram.providers';
import { BotModule } from '../bot/bot.module';
import { ChartService } from '../chart/chart.service';

@Module({
  imports: [BotModule],
  providers: [TelegramService, ChartService, ...TELEGRAM_PROVIDERS],
  exports: [TelegramService],
})
export class TelegramModule {}
