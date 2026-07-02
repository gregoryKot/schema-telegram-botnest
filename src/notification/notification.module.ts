import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationCadenceService } from './notification.cadence.service';
import { NotificationPlannerService } from './notification.planner.service';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [BotModule],
  providers: [NotificationService, NotificationCadenceService, NotificationPlannerService],
  exports: [NotificationService, NotificationCadenceService, NotificationPlannerService],
})
export class NotificationModule {}
