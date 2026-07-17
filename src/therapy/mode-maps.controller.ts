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
import { Request } from 'express';
import { uid, parseId as parseIdShared } from '../api/request-utils';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { ModeMapsService } from './mode-maps.service';
import { AccountService } from '../bot/account.service';
import {
  CustomModeDto,
  CreateModeMapDto,
  UpdateModeMapDto,
} from './dto/mode-maps.dto';

interface AuthRequest extends Request {
  telegramUserId: number;
  userRole?: string;
  webUser: { userId: bigint };
}

// uid()/parseId() — единый источник в request-utils (аудит 2026-07, 2в).
// allowNegative: виртуальные (офлайн) клиенты терапевта кодируются
// отрицательным id = -TherapyRelation.id — только в therapy-эндпоинтах.
const parseId = (raw: string): number =>
  parseIdShared(raw, { allowNegative: true });

// Карты режимов терапевта (для клиента) и кастомные режимы, плюс
// клиентский read-only доступ к своим картам (my-mode-maps).
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class ModeMapsController {
  constructor(
    private readonly modeMapsService: ModeMapsService,
    private readonly accountService: AccountService,
  ) {}

  // ─── Therapist Custom Modes ──────────────────────────────────────────────────

  @Get('custom-modes')
  async listCustomModes(@Req() req: AuthRequest) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.modeMapsService.listCustomModes(uid(req));
  }

  @Post('custom-modes')
  async createCustomMode(@Req() req: AuthRequest, @Body() body: CustomModeDto) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (!body.name?.trim()) throw new BadRequestException('name required');
    return this.modeMapsService.createCustomMode(
      uid(req),
      body as { name: string; emoji?: string; nodeType?: string },
    );
  }

  @Delete('custom-modes/:modeId')
  async deleteCustomMode(
    @Req() req: AuthRequest,
    @Param('modeId') modeId: string,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.modeMapsService.deleteCustomMode(uid(req), parseId(modeId));
    return { ok: true };
  }

  // ─── Mode Maps ───────────────────────────────────────────────────────────────

  @Get('mode-maps/:clientId')
  async listModeMaps(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.modeMapsService.listModeMaps(
        uid(req),
        parseId(clientId),
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'No active relation')
        throw new ForbiddenException();
      throw e;
    }
  }

  @Get('mode-maps/map/:mapId')
  async getModeMap(@Req() req: AuthRequest, @Param('mapId') mapId: string) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.modeMapsService.getModeMap(uid(req), parseId(mapId));
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Not found')
        throw new ForbiddenException();
      throw e;
    }
  }

  @Post('mode-maps/:clientId')
  async createModeMap(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: CreateModeMapDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const title = (body.title ?? 'Карта режимов').slice(0, 120);
    try {
      return await this.modeMapsService.createModeMap(
        uid(req),
        parseId(clientId),
        title,
        body.kind,
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'No active relation')
        throw new ForbiddenException();
      throw e;
    }
  }

  @Patch('mode-maps/map/:mapId')
  async updateModeMap(
    @Req() req: AuthRequest,
    @Param('mapId') mapId: string,
    @Body() body: UpdateModeMapDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.modeMapsService.updateModeMap(
        uid(req),
        parseId(mapId),
        body,
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Not found')
        throw new ForbiddenException();
      throw e;
    }
  }

  @Delete('mode-maps/map/:mapId')
  async deleteModeMap(@Req() req: AuthRequest, @Param('mapId') mapId: string) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      await this.modeMapsService.deleteModeMap(uid(req), parseId(mapId));
      return { ok: true };
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Not found')
        throw new ForbiddenException();
      throw e;
    }
  }

  // ─── Client's read-only view (any authed user; only their own maps) ──────────

  @Get('my-mode-maps')
  async listMyModeMaps(@Req() req: AuthRequest) {
    return this.modeMapsService.listMyModeMaps(uid(req));
  }

  @Get('my-mode-maps/:mapId')
  async getMyModeMap(@Req() req: AuthRequest, @Param('mapId') mapId: string) {
    try {
      return await this.modeMapsService.getMyModeMap(uid(req), parseId(mapId));
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Not found')
        throw new ForbiddenException();
      throw e;
    }
  }
}
