import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramAdminService } from './telegram.admin.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { CHANNEL_PROVIDERS } from '../channel/channel.providers';
import { HealthyAdultAdminController } from './healthy-adult-admin.controller';
import { TelegramSettingsService } from './telegram.settings.service';
import { TelegramNotifyActionsService } from './telegram.notify-actions.service';
import { TelegramNotifySettingsService } from './telegram.notify-settings.service';
import { TelegramSummaryToggleService } from './telegram.summary-toggle.service';
import { TelegramQuizService } from './telegram.quiz.service';
import { TelegramLinkService } from './telegram.link.service';
import { TELEGRAM_PROVIDERS } from './telegram.providers';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TherapyModule } from '../therapy/therapy.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    BotModule,
    NotificationModule,
    TherapyModule,
    AnalyticsModule,
    AuthModule, // билет привязки: сверку показывает бот (telegram.link.service)
    PushModule, // очередь шлёт и уведомления в приложение
  ],
  controllers: [HealthyAdultAdminController],
  providers: [
    TelegramService,
    TelegramAdminService,
    TelegramScheduleService,
    TelegramSettingsService,
    TelegramNotifyActionsService,
    TelegramNotifySettingsService,
    TelegramSummaryToggleService,
    TelegramQuizService,
    TelegramLinkService,
    ...TELEGRAM_PROVIDERS,
    ...CHANNEL_PROVIDERS, // канал «ЗВ»: площадки, рассылка, расписание
  ],
  exports: [TelegramService, TelegramScheduleService, TELEGRAF_BOT],
})
export class TelegramModule {}
