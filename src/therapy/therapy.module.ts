import { Module } from '@nestjs/common';
import { TherapyRelationsService } from './therapy-relations.service';
import { TherapyTasksService } from './therapy-tasks.service';
import { TherapyTasksViewService } from './therapy-tasks-view.service';
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyClientDataService } from './therapy-client-data.service';
import { ModeMapsService } from './mode-maps.service';
import { TherapyController } from './therapy.controller';
import { TherapistRequestService } from './therapist-request.service';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BotModule, NotificationModule, AuthModule],
  controllers: [TherapyController],
  providers: [
    TherapyRelationsService,
    TherapyTasksService,
    TherapyTasksViewService,
    TherapyNotesService,
    TherapyClientDataService,
    ModeMapsService,
    TherapistRequestService,
    TelegramAuthGuard,
  ],
  exports: [
    TherapyRelationsService,
    TherapyTasksService,
    TherapyTasksViewService,
    TherapyNotesService,
    TherapyClientDataService,
    ModeMapsService,
    TherapistRequestService,
  ],
})
export class TherapyModule {}
