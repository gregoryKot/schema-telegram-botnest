import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { uid, parseId as parseIdShared } from '../api/request-utils';
import { parseClientId } from '../api/parse-user-id';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { AccountService } from '../bot/account.service';
import { TherapyPlanService } from './therapy-plan.service';
import {
  CreatePlanItemsDto,
  ReorderPlanDto,
  UpdatePlanItemDto,
} from './dto/plan.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

const parseId = (raw: string): number => parseIdShared(raw, { int32: true });

// План работы с клиентом — только для терапевта: список по клиенту, создание
// (одному или нескольким клиентам), правка, удаление, порядок.
@Controller('api/therapy/plan')
@UseGuards(TelegramAuthGuard)
export class TherapyPlanController {
  constructor(
    private readonly planService: TherapyPlanService,
    private readonly accountService: AccountService,
  ) {}

  @Get(':clientId')
  list(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    return this.asTherapist(req, (tid) =>
      this.planService.list(tid, parseClientId(clientId)),
    );
  }

  // Один запрос пишет до 50 строк — окно на случай зациклившегося клиента.
  @Throttle({ long: { limit: 120, ttl: 3_600_000 } })
  @Post()
  async create(@Req() req: AuthRequest, @Body() body: CreatePlanItemsDto) {
    const { clientIds, ...input } = body;
    const items = await this.asTherapist(req, (tid) =>
      this.planService.create(tid, clientIds.map(parseClientId), input),
    );
    return { items };
  }

  @Patch('items/:id')
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: UpdatePlanItemDto,
  ) {
    if (Object.values(body).every((v) => v === undefined))
      throw new BadRequestException('Nothing to update');
    return this.asTherapist(req, (tid) =>
      this.planService.update(tid, parseId(id), body),
    );
  }

  @Delete('items/:id')
  async remove(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.asTherapist(req, (tid) =>
      this.planService.remove(tid, parseId(id)),
    );
    return { ok: true };
  }

  @Post('order/:clientId')
  async reorder(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: ReorderPlanDto,
  ) {
    await this.asTherapist(req, (tid) =>
      this.planService.reorder(tid, parseClientId(clientId), body.ids),
    );
    return { ok: true };
  }

  private async asTherapist<T>(
    req: AuthRequest,
    run: (therapistId: bigint) => Promise<T>,
  ): Promise<T> {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await run(uid(req));
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }
}
