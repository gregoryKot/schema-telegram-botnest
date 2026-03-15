import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TELEGRAM_PROVIDERS } from './telegram.providers';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [BotModule],
  providers: [TelegramService, ...TELEGRAM_PROVIDERS],
  exports: [TelegramService],
})
export class TelegramModule {}
