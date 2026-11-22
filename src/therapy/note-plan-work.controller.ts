import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { AuthRequest } from '../api/request-utils';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../bot/account.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { relationForbidden, therapistConceptKey } from './concept-access';
import { findNotePlanWork } from './note-plan-work';

// Отдельный контроллер: therapy-notes.controller.ts под храповиком размера (№10).
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class NotePlanWorkController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relations: TherapyRelationsService,
    private readonly accountService: AccountService,
  ) {}

  /** Над какими пунктами плана работали на сессиях — по записям итогов пары. */
  @Get('notes/:clientId/plan-work')
  async getNotePlanWork(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const { therapistId, clientId: cid } = await therapistConceptKey(
      this.accountService,
      req,
      clientId,
    );
    return this.relations
      .assertHasClient(therapistId, cid)
      .then(() => findNotePlanWork(this.prisma, therapistId, cid))
      .catch(relationForbidden);
  }
}
