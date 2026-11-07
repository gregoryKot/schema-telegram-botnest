import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { uid, type AuthRequest } from '../api/request-utils';
import { parseClientId } from '../api/parse-user-id';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../bot/account.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { ConceptShareDto } from './dto/concept-share.dto';
import { findSharedConcept, setConceptShared } from './concept-share';

// Схема случая для клиента: терапевт включает показ тумблером во вкладке
// «Концептуализация», клиент открывает её из «Мой терапевт» (только чтение).
// Отдельный контроллер: therapy-notes.controller.ts под храповиком размера
// (правило №10). Что видит клиент — белый список client-concept-view.ts.
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class ClientConceptController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relations: TherapyRelationsService,
    private readonly accountService: AccountService,
  ) {}

  // Клиент: своя схема от терапевта из «Мой терапевт». Нет связи, не показана
  // или показ выключен — 404 (клиенту всё равно, по какой из причин).
  @Get('my-concept')
  async getMyConcept(@Req() req: AuthRequest) {
    const view = await findSharedConcept(this.prisma, uid(req));
    if (!view) throw new NotFoundException('Case scheme is not shared');
    return view;
  }

  // Терапевт: показать клиенту схему случая или убрать показ.
  @Patch('conceptualization/:clientId/share')
  async share(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: ConceptShareDto,
  ) {
    const therapistId = uid(req);
    const role = await this.accountService.getUserRole(therapistId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const key = { therapistId, clientId: parseClientId(clientId) };
    const deps = { prisma: this.prisma, relations: this.relations };
    return setConceptShared(deps, key, body.shared).catch((e: unknown) => {
      if (e instanceof Error && e.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    });
  }
}
