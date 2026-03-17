import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [BotModule, NotificationModule],
  controllers: [ApiController],
  providers: [TelegramAuthGuard],
})
export class ApiModule {}
