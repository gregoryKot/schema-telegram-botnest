import { Module } from '@nestjs/common';
import { TherapyService } from './therapy.service';
import { TherapyController } from './therapy.controller';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BotModule, NotificationModule, AuthModule],
  controllers: [TherapyController],
  providers: [TherapyService, TelegramAuthGuard],
  exports: [TherapyService],
})
export class TherapyModule {}
