import { Module } from '@nestjs/common';
import { AccountExportController } from './account-export.controller';
import { AccountDeleteController } from './account-delete.controller';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { BotModule } from '../bot/bot.module';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { DataExportService } from '../account/data-export.service';

// Ручки «аккаунт целиком» — выгрузка и удаление (второй фактор, B-13). Вынесены
// из ApiModule: тот на потолке размера (правило №10).
@Module({
  imports: [BotModule, AuthModule, AnalyticsModule],
  controllers: [AccountExportController, AccountDeleteController],
  providers: [TelegramAuthGuard, DataExportService],
})
export class AccountApiModule {}
