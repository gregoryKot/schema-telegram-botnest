import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthRequest } from '../api/request-utils';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../bot/account.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { ConceptAppendDto } from './dto/concept-append.dto';
import { ConceptNeedsDto } from './dto/concept-needs.dto';
import { appendToConcept } from './concept-append';
import { saveConceptNeeds } from './concept-needs';
import { relationForbidden, therapistConceptKey } from './concept-access';

// Холст «Графических карт» пишет в концептуализацию клиента: дописывает режимы,
// схемы и связи (#963) и сохраняет колесо потребностей. Отдельный контроллер:
// соседний therapy-notes.controller.ts под храповиком размера (правило №10).
// Доступ — роль THERAPIST и активная связь с клиентом (concept-access.ts).
// Ответ — та же форма, что у POST conceptualization/:clientId (поля и история).
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
    const key = await therapistConceptKey(this.accountService, req, clientId);
    const deps = { prisma: this.prisma, relations: this.relations };
    return appendToConcept(deps, key, body).catch(relationForbidden);
  }

  // Колесо потребностей целиком (replace, последний пишет) — concept-needs.ts.
  @Post('conceptualization/:clientId/needs')
  async saveNeeds(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: ConceptNeedsDto,
  ) {
    const key = await therapistConceptKey(this.accountService, req, clientId);
    const deps = { prisma: this.prisma, relations: this.relations };
    return saveConceptNeeds(deps, key, body.needLinks).catch(relationForbidden);
  }
}
