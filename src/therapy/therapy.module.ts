import { Module } from '@nestjs/common';
import { TherapyRelationsService } from './therapy-relations.service';
import { TherapyInviteService } from './therapy-invite.service';
import { TherapyTasksService } from './therapy-tasks.service';
import { TherapyTasksViewService } from './therapy-tasks-view.service';
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyClientDataService } from './therapy-client-data.service';
import { ModeMapsService } from './mode-maps.service';
import { TherapyController } from './therapy.controller';
import { TherapyConnectionController } from './therapy-connection.controller';
import { TherapyInvitesController } from './therapy-invites.controller';
import { TherapyCardClaimsController } from './therapy-card-claims.controller';
import { TherapyTasksController } from './therapy-tasks.controller';
import { TherapyNotesController } from './therapy-notes.controller';
import { ModeMapsController } from './mode-maps.controller';
import { ConceptAppendController } from './concept-append.controller';
import { ClientConceptController } from './client-concept.controller';
import { TherapistRequestService } from './therapist-request.service';
import { TherapistRequestNotifyService } from './therapist-request.notify';
import { TherapistExitService } from './therapist-exit.service';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BotModule, NotificationModule, AuthModule, AnalyticsModule],
  controllers: [
    TherapyController,
    TherapyConnectionController,
    TherapyInvitesController,
    TherapyCardClaimsController,
    TherapyTasksController,
    TherapyNotesController,
    ModeMapsController,
    ConceptAppendController,
    ClientConceptController,
  ],
  providers: [
    TherapyRelationsService,
    TherapyInviteService,
    TherapyTasksService,
    TherapyTasksViewService,
    TherapyNotesService,
    TherapyClientDataService,
    ModeMapsService,
    TherapistRequestService,
    TherapistRequestNotifyService,
    TherapistExitService,
    TelegramAuthGuard,
  ],
  exports: [
    TherapyRelationsService,
    TherapyTasksService,
    TherapyClientDataService,
    ModeMapsService,
    TherapistRequestService,
  ],
})
export class TherapyModule {}
