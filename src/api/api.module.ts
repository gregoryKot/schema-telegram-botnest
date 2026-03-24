import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [BotModule, NotificationModule, TelegramModule],
  controllers: [ApiController],
  providers: [TelegramAuthGuard],
})
export class ApiModule {}
