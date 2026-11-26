import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { PushController } from './push.controller';
import { PushService } from './push.service';

// Уведомления в приложении (веб-пуши). PrismaModule глобальный — PrismaService
// инжектится напрямую. PushService берёт очередь уведомлений (TelegramModule).
@Module({
  imports: [AuthModule, AnalyticsModule],
  controllers: [PushController],
  providers: [PushService, TelegramAuthGuard],
  exports: [PushService],
})
export class PushModule {}
