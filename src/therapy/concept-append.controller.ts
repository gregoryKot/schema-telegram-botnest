import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { uid, type AuthRequest } from '../api/request-utils';
import { parseClientId } from '../api/parse-user-id';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../bot/account.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { ConceptAppendDto } from './dto/concept-append.dto';
import { appendToConcept } from './concept-append';

// Холст «Графических карт» дописывает в концептуализацию клиента режимы,
// схемы и связи схема → режим (#963). Отдельный контроллер: соседний
// therapy-notes.controller.ts под храповиком размера (правило №10). Ответ —
// та же форма, что у POST conceptualization/:clientId (поля и история).
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class ConceptAppendController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relations: TherapyRelationsService,
    private readonly accountService: AccountService,
  ) {}

  @Post('conceptualization/:clientId/append')
  async append(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: ConceptAppendDto,
  ) {
    const therapistId = uid(req);
    const role = await this.accountService.getUserRole(therapistId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const key = { therapistId, clientId: parseClientId(clientId) };
    const deps = { prisma: this.prisma, relations: this.relations };
    return appendToConcept(deps, key, body).catch((e: unknown) => {
      if (e instanceof Error && e.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    });
  }
}
