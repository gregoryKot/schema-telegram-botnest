import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { parseId, uid, type AuthRequest } from '../api/request-utils';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { AccountService } from '../bot/account.service';
import { GuideMarksService } from './guide-marks.service';
import {
  GuideMarkAddressQueryDto,
  SaveGuideMarkDto,
} from './dto/guide-mark.dto';
import { relationForbidden, therapistConceptKey } from './concept-access';

// Отметки «Про клиента» из «Справочника» (#1484). Доступ — роль THERAPIST и
// активная связь с клиентом (concept-access.ts), как у ручек холста.
@Controller('api/therapy/guide-marks')
@UseGuards(TelegramAuthGuard)
export class GuideMarksController {
  constructor(
    private readonly marks: GuideMarksService,
    private readonly accountService: AccountService,
  ) {}

  // Кому из своих клиентов терапевт уже отметил раздел: { clientIds }.
  @Get()
  async byAddress(
    @Req() req: AuthRequest,
    @Query() query: GuideMarkAddressQueryDto,
  ) {
    const therapistId = await this.therapist(req);
    const clientIds = await this.marks.clientsWithAddress(
      therapistId,
      query.address,
    );
    return { clientIds };
  }

  @Get(':clientId')
  async list(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const key = await therapistConceptKey(this.accountService, req, clientId);
    const marks = await this.marks
      .list(key.therapistId, key.clientId)
      .catch(relationForbidden);
    return { marks };
  }

  // Повтор того же адреса — правка записи; ответ { mark, created }.
  @Put(':clientId')
  async save(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: SaveGuideMarkDto,
  ) {
    const key = await therapistConceptKey(this.accountService, req, clientId);
    return this.marks
      .save(key.therapistId, key.clientId, body)
      .catch(relationForbidden);
  }

  @Delete('items/:id')
  async remove(@Req() req: AuthRequest, @Param('id') id: string) {
    const therapistId = await this.therapist(req);
    await this.marks
      .remove(therapistId, parseId(id, { int32: true }))
      .catch(relationForbidden);
    return { ok: true };
  }

  private async therapist(req: AuthRequest): Promise<bigint> {
    const therapistId = uid(req);
    const role = await this.accountService.getUserRole(therapistId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return therapistId;
  }
}
