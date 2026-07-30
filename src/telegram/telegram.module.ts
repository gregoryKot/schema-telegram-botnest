import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { CHANNEL_PROVIDERS } from '../channel/channel.providers';
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
    TelegramSettingsService,
    TelegramNotifyActionsService,
    TelegramNotifySettingsService,
    TelegramQuizService,
    ...TELEGRAM_PROVIDERS,
    ...CHANNEL_PROVIDERS, // канал «ЗВ»: площадки, рассылка, расписание
  ],
  exports: [TelegramService, TelegramScheduleService],
})
export class TelegramModule {}
