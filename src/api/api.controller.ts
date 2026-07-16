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
import { Request } from 'express';
import { uid } from './request-utils';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { ProfileService } from '../bot/profile.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { SaveDraftDto, UpdateNameDto, InitDto } from './dto/misc.dto';

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
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  // ─── Link token for mini-app users ────────────────────────────────────────
  //
  // The mini-app authenticates with `x-telegram-init-data`. To start an
  // OAuth-style provider link (Google, VK, …) it needs a JWT to pass as
  // ?link_token=… on the redirect. This endpoint issues one.

  @Get('link-token')
  async issueLinkToken(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ linkToken: string; expiresIn: number }> {
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
    const select = Object.fromEntries(
      this.FLAG_FIELDS_READ.map((f) => [f, true]),
    );
    const u = await (this.prisma.user as any).findUnique({
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
    for (const k of this.FLAG_FIELDS) if (k in body) data[k] = (body as any)[k];
    if (Object.keys(data).length === 0) return { ok: true };
    await (this.prisma.user as any).update({
      where: { id: uid(req) },
      data,
    });
    return { ok: true };
  }

  // ─── Diary drafts ──────────────────────────────────────────────────────────

  @Get('drafts')
  async getDrafts(@Req() req: AuthRequest) {
    const rows = await (this.prisma as any).diaryDraft.findMany({
      where: { userId: uid(req) },
      select: { type: true, startedAt: true, data: true },
    });
    return Object.fromEntries(
      rows.map((r: any) => [
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
    await (this.prisma as any).diaryDraft.upsert({
      where: { userId_type: { userId: uid(req), type } },
      update: { data: body.data, startedAt },
      create: { userId: uid(req), type, data: body.data, startedAt },
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
    await (this.prisma as any).diaryDraft.deleteMany({
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

  // Settings живут в settings.controller.ts — здесь был маршрут-дубль
  // (аудит 2026-07: GET/POST /api/settings регистрировались дважды).

  @Delete('user')
  async deleteUser(@Req() req: AuthRequest) {
    await this.accountService.deleteAllUserData(uid(req));
    return { ok: true };
  }
}
