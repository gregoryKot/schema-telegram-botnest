import { Module } from '@nestjs/common';
import { TherapyService } from './therapy.service';
import { TherapyController } from './therapy.controller';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';

@Module({
  imports: [BotModule, NotificationModule],
  controllers: [TherapyController],
  providers: [TherapyService, TelegramAuthGuard],
  exports: [TherapyService],
})
export class TherapyModule {}
