import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { TelegramChannelService } from './telegram.channel.service';
import { HealthyAdultAdminController } from './healthy-adult-admin.controller';
import { TelegramSettingsService } from './telegram.settings.service';
import { TelegramNotifyActionsService } from './telegram.notify-actions.service';
import { TelegramNotifySettingsService } from './telegram.notify-settings.service';
import { TelegramQuizService } from './telegram.quiz.service';
import { TELEGRAM_PROVIDERS } from './telegram.providers';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TherapyModule } from '../therapy/therapy.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [BotModule, NotificationModule, TherapyModule, AnalyticsModule],
  controllers: [HealthyAdultAdminController],
  providers: [
    TelegramService,
    TelegramScheduleService,
    TelegramChannelService,
    TelegramSettingsService,
    TelegramNotifyActionsService,
    TelegramNotifySettingsService,
    TelegramQuizService,
    ...TELEGRAM_PROVIDERS,
  ],
  exports: [TelegramService, TelegramScheduleService],
})
export class TelegramModule {}
