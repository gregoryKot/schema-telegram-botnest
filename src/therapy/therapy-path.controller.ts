import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
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
import { TherapyPathService } from './therapy-path.service';
import type { TherapyPathView } from './therapy-path.types';
import {
  AdvancePathPhaseDto,
  CreatePathDto,
  PathPhaseDraftDto,
  ReorderPathPhasesDto,
  UpdatePathDto,
  UpdatePathPhaseDto,
} from './dto/path.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

const parseId = (raw: string): number => parseIdShared(raw, { int32: true });

// Путь клиента — только для терапевта. Каждая ручка отдаёт путь целиком:
// `{ path }`, после удаления пути — `{ path: null }`.
@Controller('api/therapy/path')
@UseGuards(TelegramAuthGuard)
export class TherapyPathController {
  constructor(
    private readonly pathService: TherapyPathService,
    private readonly accountService: AccountService,
  ) {}

  // Ручки по id фазы стоят выше `:clientId`: статический сегмент `phases`
  // не должен разбираться как id клиента.
  @Patch('phases/:id')
  updatePhase(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: UpdatePathPhaseDto,
  ) {
    if (Object.values(body).every((v) => v === undefined))
      throw new BadRequestException('Nothing to update');
    return this.asTherapist(req, (tid) =>
      this.pathService.updatePhase(tid, parseId(id), body),
    );
  }

  @HttpCode(200)
  @Post('phases/:id/advance')
  advance(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: AdvancePathPhaseDto,
  ) {
    return this.asTherapist(req, (tid) =>
      this.pathService.advance(tid, parseId(id), body.date),
    );
  }

  @Delete('phases/:id')
  removePhase(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.asTherapist(req, (tid) =>
      this.pathService.removePhase(tid, parseId(id)),
    );
  }

  @Get(':clientId')
  get(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    return this.asTherapist(req, (tid) =>
      this.pathService.get(tid, parseClientId(clientId)),
    );
  }

  // Один запрос пишет до 21 строки — окно на случай зациклившегося клиента.
  @Throttle({ long: { limit: 120, ttl: 3_600_000 } })
  @Post(':clientId')
  create(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: CreatePathDto,
  ) {
    return this.asTherapist(req, (tid) =>
      this.pathService.create(tid, parseClientId(clientId), body),
    );
  }

  @Patch(':clientId')
  setStart(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: UpdatePathDto,
  ) {
    return this.asTherapist(req, (tid) =>
      this.pathService.setStart(tid, parseClientId(clientId), body.startDate),
    );
  }

  @Delete(':clientId')
  remove(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    return this.asTherapist(req, async (tid) => {
      await this.pathService.remove(tid, parseClientId(clientId));
      return null;
    });
  }

  @Post(':clientId/phases')
  addPhase(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: PathPhaseDraftDto,
  ) {
    return this.asTherapist(req, (tid) =>
      this.pathService.addPhase(tid, parseClientId(clientId), body),
    );
  }

  @HttpCode(200)
  @Post(':clientId/phases/order')
  reorder(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: ReorderPathPhasesDto,
  ) {
    return this.asTherapist(req, (tid) =>
      this.pathService.reorder(tid, parseClientId(clientId), body.ids),
    );
  }

  private async asTherapist(
    req: AuthRequest,
    run: (therapistId: bigint) => Promise<TherapyPathView | null>,
  ): Promise<{ path: TherapyPathView | null }> {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return { path: await run(uid(req)) };
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }
}
