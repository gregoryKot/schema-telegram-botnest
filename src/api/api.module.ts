import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { HealthController } from './health.controller';
import { DiaryController } from './diary.controller';
import { BookingController } from './booking.controller';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TherapyModule } from '../therapy/therapy.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    BotModule,
    NotificationModule,
    TelegramModule,
    TherapyModule,
    AuthModule,
  ],
  controllers: [
    ApiController,
    DiaryController,
    BookingController,
    HealthController,
  ],
  providers: [TelegramAuthGuard],
})
export class ApiModule {}
