import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { YsqController } from './ysq.controller';
import { PairsController } from './pairs.controller';
import { PlansController } from './plans.controller';
import { ExercisesController } from './exercises.controller';
import { NotesController } from './notes.controller';
import { TrackerController } from './tracker.controller';
import { HealthController } from './health.controller';
import { DiaryController } from './diary.controller';
import { BookingController } from './booking.controller';
import { ClientErrorsController } from './client-errors.controller';
import { AnalyticsController } from './analytics.controller';
import { JourneyController } from './journey.controller';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TherapyModule } from '../therapy/therapy.module';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    BotModule,
    NotificationModule,
    TelegramModule,
    TherapyModule,
    AuthModule,
    AnalyticsModule,
  ],
  controllers: [
    ApiController,
    YsqController,
    PairsController,
    PlansController,
    ExercisesController,
    NotesController,
    TrackerController,
    DiaryController,
    BookingController,
    AnalyticsController,
    JourneyController,
    HealthController,
    ClientErrorsController,
  ],
  providers: [TelegramAuthGuard],
})
export class ApiModule {}
