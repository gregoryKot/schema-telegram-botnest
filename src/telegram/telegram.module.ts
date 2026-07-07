import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { TelegramSettingsService } from './telegram.settings.service';
import { TelegramNotifyActionsService } from './telegram.notify-actions.service';
import { TelegramNotifySettingsService } from './telegram.notify-settings.service';
import { TELEGRAM_PROVIDERS } from './telegram.providers';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TherapyModule } from '../therapy/therapy.module';

@Module({
  imports: [BotModule, NotificationModule, TherapyModule],
  providers: [TelegramService, TelegramScheduleService, TelegramSettingsService, TelegramNotifyActionsService, TelegramNotifySettingsService, ...TELEGRAM_PROVIDERS],
  exports: [TelegramService, TelegramScheduleService],
})
export class TelegramModule {}
