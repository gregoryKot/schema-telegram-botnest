import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { uid } from './request-utils';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { ProfileService } from '../bot/profile.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { TelegramScheduleService } from '../telegram/telegram.schedule.service';
import { UpdateNameDto, InitDto } from './dto/misc.dto';
import { FLAG_FIELDS } from './flag-fields';

interface AuthRequest extends Request {
  telegramFirstName?: string;
  webUser: { userId: bigint };
}

// uid()/parseId() — единый источник в request-utils (аудит 2026-07, 2в).
// Остальные домены API вынесены в соседние контроллеры (см. api.module.ts):
// ysq/pairs/plans/exercises/notes/tracker.controller.ts.

// Реестр FLAG_FIELDS — см. ./flag-fields.ts (переиспользуется merge.service
// при слиянии аккаунтов, правило №4). Писателя у флагов через API нет:
// POST /api/user-flags писал только удалённый мини-апп (#908); колонки и
// чтение остались (GET — therapistMode для сайта).

@Controller('api')
@UseGuards(TelegramAuthGuard)
export class ApiController {
  constructor(
    private readonly botService: BotService,
    private readonly accountService: AccountService,
    private readonly profileService: ProfileService,
    private readonly prisma: PrismaService,
    private readonly scheduleService: TelegramScheduleService,
  ) {}

  private readonly logger = new Logger(ApiController.name);

  // ─── Typed UI flags ────────────────────────────────────────────────────────

  // Флаги для GET: реестр плюс therapistMode (его ставит сервер из role).
  private readonly FLAG_FIELDS_READ = [
    ...FLAG_FIELDS,
    'therapistMode',
  ] as const;

  @Get('user-flags')
  async getUserFlags(@Req() req: AuthRequest) {
    const select: Prisma.UserSelect = {};
    for (const f of this.FLAG_FIELDS_READ) select[f] = true;
    const u = await this.prisma.user.findUnique({
      where: { id: uid(req) },
      select,
    });
    return u ?? {};
  }

  @Get('profile')
  async getProfile(@Req() req: AuthRequest) {
    return this.profileService.getProfile(uid(req));
  }

  @Post('profile/name')
  async updateName(@Req() req: AuthRequest, @Body() body: UpdateNameDto) {
    const name = body.name?.trim();
    if (!name || name.length > 50)
      throw new BadRequestException('Invalid name');
    await this.accountService.updateName(uid(req), name);
    return { ok: true };
  }

  // body.timezone — пояс устройства; пока человек не выбрал пояс сам, он
  // становится поясом уведомлений, и напоминание переносится на новый час.
  @Post('init')
  async init(@Req() req: AuthRequest, @Body() body: InitDto) {
    const tzChanged = await this.accountService.registerUser(
      uid(req),
      req.telegramFirstName,
      body.timezone,
    );
    if (tzChanged) {
      await this.scheduleService
        .rescheduleForUser(uid(req))
        .catch((err) => this.logger.error('init: reschedule failed', err));
    }
    return { ok: true };
  }

  // ─── Disclaimer ─────────────────────────────────────────────────────────────

  @Get('disclaimer')
  async getDisclaimer(@Req() req: AuthRequest) {
    const accepted = await this.botService.hasAcceptedDisclaimer(uid(req));
    return { accepted };
  }

  @Post('disclaimer')
  async acceptDisclaimer(@Req() req: AuthRequest) {
    await this.botService.acceptDisclaimer(uid(req), true);
    return { ok: true };
  }

  // Settings живут в settings.controller.ts — здесь был маршрут-дубль
  // (аудит 2026-07: GET/POST /api/settings регистрировались дважды).

  // DELETE /api/user живёт в account-delete.controller.ts (второй фактор, B-13).
}
