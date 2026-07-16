import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { uid } from './request-utils';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { ProfileService } from '../bot/profile.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { TelegramScheduleService } from '../telegram/telegram.schedule.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { VALID_TIMEZONES } from '../telegram/telegram.constants';
import { SaveDraftDto, UpdateNameDto, InitDto } from './dto/misc.dto';
import { UpdateSettingsDto } from './dto/settings.dto';

interface AuthRequest extends Request {
  telegramUserId: number;
  telegramFirstName?: string;
  webUser: { userId: bigint };
}

// uid()/parseId() — единый источник в request-utils (аудит 2026-07, 2в).
// Остальные домены API вынесены в соседние контроллеры (см. api.module.ts):
// ysq/pairs/plans/exercises/notes/tracker.controller.ts.

@Controller('api')
@UseGuards(TelegramAuthGuard)
export class ApiController {
  constructor(
    private readonly botService: BotService,
    private readonly accountService: AccountService,
    private readonly profileService: ProfileService,
    private readonly scheduleService: TelegramScheduleService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  // ─── Link token for mini-app users ────────────────────────────────────────
  //
  // The mini-app authenticates with `x-telegram-init-data`. To start an
  // OAuth-style provider link (Google, VK, …) it needs a JWT to pass as
  // ?link_token=… on the redirect. This endpoint issues one.

  @Get('link-token')
  issueLinkToken(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): { linkToken: string; expiresIn: number } {
    const linkToken = this.authService.buildLinkToken(uid(req));
    // httpOnly-cookie — основной канал (S-4, токен не в URL); тело ответа —
    // обратная совместимость со старыми клиентами (?link_token=).
    res.cookie('link_token', linkToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      maxAge: 60_000,
      path: '/api/auth',
    });
    return { linkToken, expiresIn: 60 };
  }

  // ─── Typed UI flags ────────────────────────────────────────────────────────

  // Client-writable UI flags. `therapistMode` deliberately NOT in this list:
  // it's the de-facto "is therapist UI" flag and is derived server-side from
  // `role` (see account.service.setRole). Letting clients flip it would be a
  // privilege escalation into therapist UI.
  private readonly FLAG_FIELDS = [
    'themePref',
    'onboardingV1Done',
    'onboardingV2Done',
    'onboardingSkipped',
    'practicesOnboardingDone',
    'childhoodWheelDone',
    'ysqBannerDismissed',
    'hintSheetCloseShown',
    'hintHistoryDismissed',
    'trackerOnboardingDone',
    'lastCelebrationDate',
    'lastYesterdayBannerDate',
    'lastWeeklyQuestionWeek',
    'schemaIntrosShown',
    'modeIntrosShown',
    'defaultSection',
  ] as const;

  // Read-only flags — returned by GET but not writable via POST.
  private readonly FLAG_FIELDS_READ = [
    ...this.FLAG_FIELDS,
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

  @Post('user-flags')
  async setUserFlags(
    @Req() req: AuthRequest,
    // Не DTO: map произвольных флагов, фильтруется по FLAG_FIELDS ниже.
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    if (!body || typeof body !== 'object')
      throw new BadRequestException('Invalid body');
    const data: Record<string, unknown> = {};
    for (const k of this.FLAG_FIELDS) if (k in body) data[k] = body[k];
    if (Object.keys(data).length === 0) return { ok: true };
    await this.prisma.user.update({
      where: { id: uid(req) },
      data,
    });
    return { ok: true };
  }

  // ─── Diary drafts ──────────────────────────────────────────────────────────

  @Get('drafts')
  async getDrafts(@Req() req: AuthRequest) {
    const rows = await this.prisma.diaryDraft.findMany({
      where: { userId: uid(req) },
      select: { type: true, startedAt: true, data: true },
    });
    return Object.fromEntries(
      rows.map((r) => [
        r.type,
        { startedAt: r.startedAt.toISOString(), data: r.data },
      ]),
    );
  }

  @Post('drafts/:type')
  async saveDraft(
    @Req() req: AuthRequest,
    @Param('type') type: string,
    @Body() body: SaveDraftDto,
  ): Promise<{ ok: true }> {
    if (!['schema', 'mode', 'gratitude'].includes(type))
      throw new BadRequestException('Invalid type');
    if (!body?.startedAt) throw new BadRequestException('Missing startedAt');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(body.startedAt))
      throw new BadRequestException('Invalid startedAt format');
    const startedAt = new Date(body.startedAt);
    if (isNaN(startedAt.getTime()))
      throw new BadRequestException('Invalid startedAt value');
    const data = body.data as Prisma.InputJsonValue;
    await this.prisma.diaryDraft.upsert({
      where: { userId_type: { userId: uid(req), type } },
      update: { data, startedAt },
      create: { userId: uid(req), type, data, startedAt },
    });
    return { ok: true };
  }

  @Delete('drafts/:type')
  async deleteDraft(
    @Req() req: AuthRequest,
    @Param('type') type: string,
  ): Promise<{ ok: true }> {
    if (!['schema', 'mode', 'gratitude'].includes(type))
      throw new BadRequestException('Invalid type');
    await this.prisma.diaryDraft.deleteMany({
      where: { userId: uid(req), type },
    });
    return { ok: true };
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

  @Post('init')
  async init(@Req() req: AuthRequest, @Body() body: InitDto) {
    await this.accountService.registerUser(
      uid(req),
      req.telegramFirstName,
      body.timezone,
    );
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
    await this.botService.acceptDisclaimer(uid(req));
    return { ok: true };
  }

  // ─── Settings ───────────────────────────────────────────────────────────────

  @Get('settings')
  async getSettings(@Req() req: AuthRequest) {
    const s = await this.botService.getUserSettings(uid(req));
    return {
      notifyEnabled: s?.notifyEnabled ?? true,
      notifyLocalHour: s?.notifyLocalHour ?? 21,
      notifyTimezone: s?.notifyTimezone ?? 'Europe/Moscow',
      notifyReminderEnabled: s?.notifyReminderEnabled ?? true,
      notifyFrequency: s?.notifyFrequency ?? 0,
      notifyQuietStart: s?.notifyQuietStart ?? 22,
      notifyQuietEnd: s?.notifyQuietEnd ?? 8,
      notifyGamified: s?.notifyGamified ?? false,
      notifyPausedUntil: s?.notifyPausedUntil?.toISOString() ?? null,
      addressForm: s?.addressForm ?? null,
      pairCardDismissed: s?.pairCardDismissed ?? false,
      mySchemaIds: Array.isArray(s?.mySchemaIds)
        ? (s.mySchemaIds as string[])
        : [],
      myModeIds: Array.isArray(s?.myModeIds) ? (s.myModeIds as string[]) : [],
      therapistShareCards: s?.therapistShareCards ?? true,
      therapistShareProfile: s?.therapistShareProfile ?? true,
    };
  }

  @Post('settings')
  async updateSettings(
    @Req() req: AuthRequest,
    @Body() body: UpdateSettingsDto,
  ) {
    const clean: Parameters<typeof this.botService.updateUserSettings>[1] = {};
    if (typeof body.notifyEnabled === 'boolean')
      clean.notifyEnabled = body.notifyEnabled;
    if (typeof body.notifyReminderEnabled === 'boolean')
      clean.notifyReminderEnabled = body.notifyReminderEnabled;
    if (typeof body.notifyGamified === 'boolean')
      clean.notifyGamified = body.notifyGamified;
    if (typeof body.pairCardDismissed === 'boolean')
      clean.pairCardDismissed = body.pairCardDismissed;
    if (
      Number.isInteger(body.notifyLocalHour) &&
      body.notifyLocalHour! >= 0 &&
      body.notifyLocalHour! <= 23
    )
      clean.notifyLocalHour = body.notifyLocalHour;
    if (
      typeof body.notifyTimezone === 'string' &&
      VALID_TIMEZONES.includes(body.notifyTimezone)
    )
      clean.notifyTimezone = body.notifyTimezone;
    if (
      Number.isInteger(body.notifyFrequency) &&
      body.notifyFrequency! >= 0 &&
      body.notifyFrequency! <= 3
    )
      clean.notifyFrequency = body.notifyFrequency;
    if (
      Number.isInteger(body.notifyQuietStart) &&
      body.notifyQuietStart! >= 0 &&
      body.notifyQuietStart! <= 23
    )
      clean.notifyQuietStart = body.notifyQuietStart;
    if (
      Number.isInteger(body.notifyQuietEnd) &&
      body.notifyQuietEnd! >= 0 &&
      body.notifyQuietEnd! <= 23
    )
      clean.notifyQuietEnd = body.notifyQuietEnd;
    // Возобновление паузы из UI: единственное допустимое значение — null
    if (body.notifyPausedUntil === null) clean.notifyPausedUntil = null;
    if (body.addressForm === 'ty' || body.addressForm === 'vy')
      clean.addressForm = body.addressForm;
    if (
      Array.isArray(body.mySchemaIds) &&
      body.mySchemaIds.length <= 200 &&
      body.mySchemaIds.every((id) => typeof id === 'string' && id.length < 100)
    )
      clean.mySchemaIds = body.mySchemaIds;
    if (
      Array.isArray(body.myModeIds) &&
      body.myModeIds.length <= 200 &&
      body.myModeIds.every((id) => typeof id === 'string' && id.length < 100)
    )
      clean.myModeIds = body.myModeIds;
    if (typeof body.therapistShareCards === 'boolean')
      clean.therapistShareCards = body.therapistShareCards;
    if (typeof body.therapistShareProfile === 'boolean')
      clean.therapistShareProfile = body.therapistShareProfile;
    await this.botService.updateUserSettings(uid(req), clean);

    // Явный выбор частоты сбрасывает адаптацию на выбранный уровень
    if ('notifyFrequency' in clean) {
      await this.accountService.setAdaptiveLevel(
        uid(req),
        clean.notifyFrequency!,
      );
    }

    // Reschedule reminder if notification time/toggle changed
    if (
      'notifyEnabled' in clean ||
      'notifyLocalHour' in clean ||
      'notifyTimezone' in clean ||
      'notifyReminderEnabled' in clean ||
      'notifyFrequency' in clean ||
      'notifyPausedUntil' in clean
    ) {
      await this.scheduleService.rescheduleForUser(uid(req));
    }

    return { ok: true };
  }

  @Delete('user')
  async deleteUser(@Req() req: AuthRequest) {
    await this.accountService.deleteAllUserData(uid(req));
    return { ok: true };
  }
}
