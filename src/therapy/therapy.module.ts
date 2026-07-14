import { Module } from '@nestjs/common';
import { TherapyRelationsService } from './therapy-relations.service';
import { TherapyTasksService } from './therapy-tasks.service';
import { TherapyTasksViewService } from './therapy-tasks-view.service';
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyClientDataService } from './therapy-client-data.service';
import { ModeMapsService } from './mode-maps.service';
import { TherapyController } from './therapy.controller';
import { TherapyConnectionController } from './therapy-connection.controller';
import { TherapyTasksController } from './therapy-tasks.controller';
import { TherapyNotesController } from './therapy-notes.controller';
import { ModeMapsController } from './mode-maps.controller';
import { TherapistRequestService } from './therapist-request.service';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BotModule, NotificationModule, AuthModule],
  controllers: [
    TherapyController,
    TherapyConnectionController,
    TherapyTasksController,
    TherapyNotesController,
    ModeMapsController,
  ],
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
