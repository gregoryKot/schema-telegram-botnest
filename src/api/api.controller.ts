import { BadRequestException, Body, Controller, Delete, Get, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { ProfileService } from '../bot/profile.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { NotificationService } from '../notification/notification.service';
import { TelegramScheduleService } from '../telegram/telegram.schedule.service';
import { TherapyService } from '../therapy/therapy.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { VALID_TIMEZONES } from '../telegram/telegram.constants';
import { computeYsqScores } from '../utils/ysq';

interface AuthRequest extends Request {
  telegramUserId: number;
  telegramFirstName?: string;
  webUser: { userId: bigint };
}

/** Returns the canonical BigInt userId — always precise, even for Google/VK accounts. */
function uid(req: AuthRequest): bigint { return req.webUser.userId; }

function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestException('Invalid id');
  return n;
}

@Controller('api')
@UseGuards(TelegramAuthGuard)
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly profileService: ProfileService,
    private readonly notificationService: NotificationService,
    private readonly scheduleService: TelegramScheduleService,
    private readonly therapyService: TherapyService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  // ─── Link token for mini-app users ────────────────────────────────────────
  //
  // The mini-app authenticates with `x-telegram-init-data`. To start an
  // OAuth-style provider link (Google, VK, …) it needs a JWT to pass as
  // ?link_token=… on the redirect. This endpoint issues one.

  @Get('link-token')
  async issueLinkToken(@Req() req: AuthRequest): Promise<{ linkToken: string; expiresIn: number }> {
    return { linkToken: this.authService.buildLinkToken(uid(req)), expiresIn: 60 };
  }

  // ─── Typed UI flags ────────────────────────────────────────────────────────

  // Client-writable UI flags. `therapistMode` deliberately NOT in this list:
  // it's the de-facto "is therapist UI" flag and is derived server-side from
  // `role` (see bot.service.setRole). Letting clients flip it would be a
  // privilege escalation into therapist UI.
  private readonly FLAG_FIELDS = [
    'themePref', 'onboardingV1Done', 'onboardingV2Done', 'onboardingSkipped',
    'practicesOnboardingDone', 'childhoodWheelDone', 'ysqBannerDismissed',
    'hintSheetCloseShown', 'hintHistoryDismissed', 'trackerOnboardingDone',
    'lastCelebrationDate', 'lastYesterdayBannerDate', 'lastWeeklyQuestionWeek',
    'schemaIntrosShown', 'modeIntrosShown',
    'defaultSection',
  ] as const;

  // Read-only flags — returned by GET but not writable via POST.
  private readonly FLAG_FIELDS_READ = [...this.FLAG_FIELDS, 'therapistMode'] as const;

  @Get('user-flags')
  async getUserFlags(@Req() req: AuthRequest) {
    const select = Object.fromEntries(this.FLAG_FIELDS_READ.map(f => [f, true]));
    const u = await (this.prisma.user as any).findUnique({
      where: { id: uid(req) },
      select,
    });
    return u ?? {};
  }

  @Post('user-flags')
  async setUserFlags(
    @Req() req: AuthRequest,
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    if (!body || typeof body !== 'object') throw new BadRequestException('Invalid body');
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
    return Object.fromEntries(rows.map((r: any) => [r.type, { startedAt: r.startedAt.toISOString(), data: r.data }]));
  }

  @Post('drafts/:type')
  async saveDraft(
    @Req() req: AuthRequest,
    @Param('type') type: string,
    @Body() body: { startedAt: string; data: unknown },
  ): Promise<{ ok: true }> {
    if (!['schema', 'mode', 'gratitude'].includes(type)) throw new BadRequestException('Invalid type');
    if (!body?.startedAt) throw new BadRequestException('Missing startedAt');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(body.startedAt)) throw new BadRequestException('Invalid startedAt format');
    const startedAt = new Date(body.startedAt);
    if (isNaN(startedAt.getTime())) throw new BadRequestException('Invalid startedAt value');
    await (this.prisma as any).diaryDraft.upsert({
      where: { userId_type: { userId: uid(req), type } },
      update: { data: body.data, startedAt },
      create: { userId: uid(req), type, data: body.data, startedAt },
    });
    return { ok: true };
  }

  @Delete('drafts/:type')
  async deleteDraft(@Req() req: AuthRequest, @Param('type') type: string): Promise<{ ok: true }> {
    if (!['schema', 'mode', 'gratitude'].includes(type)) throw new BadRequestException('Invalid type');
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
  async updateName(@Req() req: AuthRequest, @Body() body: { name: string }) {
    const name = body.name?.trim();
    if (!name || name.length > 50) throw new BadRequestException('Invalid name');
    await this.botService.updateName(uid(req), name);
    return { ok: true };
  }

  @Post('init')
  async init(@Req() req: AuthRequest, @Body() body: { timezone?: string }) {
    await this.botService.registerUser(uid(req), req.telegramFirstName, body.timezone);
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

  // ─── YSQ Progress ────────────────────────────────────────────────────────────

  @Get('ysq-progress')
  async getYsqProgress(@Req() req: AuthRequest) {
    return this.botService.getYsqProgress(uid(req));
  }

  @Post('ysq-progress')
  async saveYsqProgress(@Req() req: AuthRequest, @Body() body: { answers: number[]; page: number }) {
    if (!Array.isArray(body.answers) || body.answers.length !== 116) throw new BadRequestException('Invalid answers');
    if (!body.answers.every(a => Number.isInteger(a) && a >= 0 && a <= 6)) throw new BadRequestException('Invalid answer values');
    if (!Number.isInteger(body.page) || body.page < 0) throw new BadRequestException('Invalid page');
    await this.botService.saveYsqProgress(uid(req), body.answers, body.page);
    return { ok: true };
  }

  @Delete('ysq-progress')
  async deleteYsqProgress(@Req() req: AuthRequest) {
    await this.botService.deleteYsqProgress(uid(req));
    return { ok: true };
  }

  @Get('needs')
  getNeeds() {
    return this.botService.getNeeds();
  }

  @Get('ratings')
  async getRatings(@Req() req: AuthRequest, @Query('date') date?: string) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Invalid date format');
    return this.botService.getRatings(uid(req), date);
  }

  @Post('rating')
  async saveRating(@Req() req: AuthRequest, @Body() body: { needId: string; value: number; date?: string }) {
    if (!NEED_IDS.includes(body.needId as NeedId) || !Number.isInteger(body.value) || body.value < 0 || body.value > 10) {
      throw new BadRequestException('Invalid needId or value');
    }
    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new BadRequestException('Invalid date');
    await this.botService.saveRating(uid(req), body.needId as NeedId, body.value, body.date);
    this.therapyService.checkStreakTasks(uid(req)).catch((err) => this.logger.error('checkStreakTasks failed', err));

    // Skip diary-complete logic for historical backfill
    if (body.date) return { ok: true, allDone: false };

    // Check if all needs are now rated today → trigger diary-complete logic
    const ratings = await this.botService.getRatings(uid(req));
    const allDone = NEED_IDS.every(id => ratings[id] !== undefined);
    if (allDone) {
      const [streak] = await Promise.all([
        this.analyticsService.getStreakData(uid(req)).catch((err) => {
          this.logger.error('getStreakData failed', err);
          return null;
        }),
        this.scheduleService.onDiaryComplete(uid(req)).catch((err) => {
          this.logger.error('onDiaryComplete failed', err);
        }),
      ]);
      return { ok: true, allDone: true, streak };
    }

    return { ok: true, allDone: false };
  }

  @Get('history')
  async getHistory(@Req() req: AuthRequest, @Query('days') days?: string) {
    const n = Math.min(Number(days) || 7, 30);
    return this.analyticsService.getHistoryRatings(uid(req), n);
  }

  @Get('streak')
  async getStreak(@Req() req: AuthRequest) {
    return this.analyticsService.getStreakData(uid(req));
  }

  @Post('activity')
  async recordActivity(@Req() req: AuthRequest) {
    return this.analyticsService.recordActivity(uid(req));
  }

  @Get('export')
  async getExport(@Req() req: AuthRequest) {
    const [history, streak] = await Promise.all([
      this.analyticsService.getHistoryRatings(uid(req), 30),
      this.analyticsService.getStreakData(uid(req)),
    ]);
    const needs = this.botService.getNeeds();
    const lines: string[] = [`📔 Трекер потребностей · последние ${history.length} дней`, ''];
    for (const day of [...history].reverse()) {
      const vals = needs.map(n => {
        const v = day.ratings[n.id as import('../bot/bot.service').NeedId];
        return v !== undefined ? `${n.emoji} ${v}/10` : `${n.emoji} –`;
      });
      lines.push(`${day.date}: ${vals.join('  ')}`);
    }
    lines.push('');
    lines.push(`Серия: ${streak.currentStreak} дн. · Рекорд: ${streak.longestStreak} · Всего: ${streak.totalDays}`);
    return { text: lines.join('\n') };
  }

  @Get('insights')
  async getInsights(@Req() req: AuthRequest) {
    const [weeklyStats, bestDayOfWeek, worstDayOfWeek, streak] = await Promise.all([
      this.analyticsService.getWeeklyStats(uid(req)),
      this.analyticsService.getBestDayOfWeek(uid(req)),
      this.analyticsService.getWorstDayOfWeek(uid(req)),
      this.analyticsService.getStreakData(uid(req)),
    ]);
    return { weeklyStats, bestDayOfWeek, worstDayOfWeek, totalDays: streak.totalDays };
  }

  @Get('achievements')
  async getAchievements(@Req() req: AuthRequest) {
    const [achievements, pairs] = await Promise.all([
      this.analyticsService.getAchievements(uid(req)),
      this.botService.getUserPairs(uid(req)),
    ]);
    const hasPair = pairs.some(p => p.status === 'active');
    return [...achievements, { id: 'pair_connected', earned: hasPair }];
  }

  @Get('note')
  async getNote(@Req() req: AuthRequest, @Query('date') date: string) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Invalid date format');
    return this.botService.getNote(uid(req), date);
  }

  @Post('note')
  async saveNote(@Req() req: AuthRequest, @Body() body: { date: string; text: string; tags?: string[] }) {
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || typeof body.text !== 'string') throw new BadRequestException();
    await this.botService.saveNote(uid(req), body.date, body.text.slice(0, 500), body.tags);
    return { ok: true };
  }

  @Get('pair')
  async getPair(@Req() req: AuthRequest) {
    const pairs = await this.botService.getUserPairs(uid(req));
    const activePairs = pairs.filter(p => p.status === 'active');
    const pendingPair = pairs.find(p => p.status === 'pending' && p.isCreator);

    const partners = await Promise.all(activePairs.map(async pair => {
      const [partnerRatings, partnerName, partnerHistory] = await Promise.all([
        this.botService.getRatings(BigInt(pair.partnerId!)),
        this.botService.getUserFirstName(BigInt(pair.partnerId!)),
        this.analyticsService.getHistoryRatings(BigInt(pair.partnerId!), 7),
      ]);
      const partnerRaw = NEED_IDS.reduce((s, id) => s + (partnerRatings[id] ?? 0), 0) / NEED_IDS.length;
      const partnerTodayDone = NEED_IDS.every(id => partnerRatings[id] !== undefined);
      const histByDate = new Map(partnerHistory.map(d => [d.date, d.ratings]));
      const partnerWeekAvgs = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const date = d.toISOString().split('T')[0];
        const ratings = histByDate.get(date);
        if (!ratings) return null;
        const done = NEED_IDS.every(id => ratings[id as NeedId] !== undefined);
        if (!done) return null;
        const avg = NEED_IDS.reduce((s, id) => s + (ratings[id as NeedId] ?? 0), 0) / NEED_IDS.length;
        return Math.round(avg * 10) / 10;
      });
      return {
        code: pair.code,
        partnerIndex: partnerTodayDone ? Math.round(partnerRaw * 10) / 10 : null,
        partnerTodayDone,
        partnerName,
        partnerTelegramId: pair.partnerId,
        partnerWeekAvgs,
      };
    }));

    return { partners, pendingCode: pendingPair?.code ?? null };
  }

  @Post('pair/invite')
  async createPairInvite(@Req() req: AuthRequest) {
    const code = await this.botService.createPairInvite(uid(req));
    const url = `https://t.me/SchemaLabBot/diary?startapp=pair_${code}`;
    return { code, url };
  }

  @Post('pair/join')
  async joinPair(@Req() req: AuthRequest, @Body() body: { code: string }) {
    if (!body.code || !/^[A-Z0-9]{5,12}$/i.test(body.code)) throw new BadRequestException('Invalid code format');
    const ok = await this.botService.joinPair(uid(req), body.code.toUpperCase());
    if (!ok) throw new BadRequestException('Invalid or expired code');
    return { ok: true };
  }

  @Delete('pair')
  async leavePair(@Req() req: AuthRequest, @Body() body: { code: string }) {
    if (!body.code) throw new BadRequestException('Code required');
    await this.botService.leavePair(uid(req), body.code);
    return { ok: true };
  }

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
      mySchemaIds: Array.isArray(s?.mySchemaIds) ? (s.mySchemaIds as string[]) : [],
      myModeIds: Array.isArray(s?.myModeIds) ? (s.myModeIds as string[]) : [],
      therapistShareCards: s?.therapistShareCards ?? true,
      therapistShareProfile: s?.therapistShareProfile ?? true,
    };
  }

  @Post('settings')
  async updateSettings(
    @Req() req: AuthRequest,
    @Body() body: { notifyEnabled?: boolean; notifyLocalHour?: number; notifyTimezone?: string; notifyReminderEnabled?: boolean; notifyFrequency?: number; notifyQuietStart?: number; notifyQuietEnd?: number; notifyGamified?: boolean; notifyPausedUntil?: null; addressForm?: string; pairCardDismissed?: boolean; mySchemaIds?: string[]; myModeIds?: string[]; therapistShareCards?: boolean; therapistShareProfile?: boolean },
  ) {
    const clean: Parameters<typeof this.botService.updateUserSettings>[1] = {};
    if (typeof body.notifyEnabled === 'boolean') clean.notifyEnabled = body.notifyEnabled;
    if (typeof body.notifyReminderEnabled === 'boolean') clean.notifyReminderEnabled = body.notifyReminderEnabled;
    if (typeof body.notifyGamified === 'boolean') clean.notifyGamified = body.notifyGamified;
    if (typeof body.pairCardDismissed === 'boolean') clean.pairCardDismissed = body.pairCardDismissed;
    if (Number.isInteger(body.notifyLocalHour) && body.notifyLocalHour! >= 0 && body.notifyLocalHour! <= 23) clean.notifyLocalHour = body.notifyLocalHour;
    if (typeof body.notifyTimezone === 'string' && VALID_TIMEZONES.includes(body.notifyTimezone)) clean.notifyTimezone = body.notifyTimezone;
    if (Number.isInteger(body.notifyFrequency) && body.notifyFrequency! >= 0 && body.notifyFrequency! <= 3) clean.notifyFrequency = body.notifyFrequency;
    if (Number.isInteger(body.notifyQuietStart) && body.notifyQuietStart! >= 0 && body.notifyQuietStart! <= 23) clean.notifyQuietStart = body.notifyQuietStart;
    if (Number.isInteger(body.notifyQuietEnd) && body.notifyQuietEnd! >= 0 && body.notifyQuietEnd! <= 23) clean.notifyQuietEnd = body.notifyQuietEnd;
    // Возобновление паузы из UI: единственное допустимое значение — null
    if (body.notifyPausedUntil === null) clean.notifyPausedUntil = null;
    if (body.addressForm === 'ty' || body.addressForm === 'vy') clean.addressForm = body.addressForm;
    if (Array.isArray(body.mySchemaIds) && body.mySchemaIds.length <= 200 && body.mySchemaIds.every(id => typeof id === 'string' && id.length < 100)) clean.mySchemaIds = body.mySchemaIds;
    if (Array.isArray(body.myModeIds) && body.myModeIds.length <= 200 && body.myModeIds.every(id => typeof id === 'string' && id.length < 100)) clean.myModeIds = body.myModeIds;
    if (typeof body.therapistShareCards === 'boolean') clean.therapistShareCards = body.therapistShareCards;
    if (typeof body.therapistShareProfile === 'boolean') clean.therapistShareProfile = body.therapistShareProfile;
    await this.botService.updateUserSettings(uid(req), clean);

    // Явный выбор частоты сбрасывает адаптацию на выбранный уровень
    if ('notifyFrequency' in clean) {
      await this.botService.setAdaptiveLevel(uid(req), clean.notifyFrequency!);
    }

    // Reschedule reminder if notification time/toggle changed
    if ('notifyEnabled' in clean || 'notifyLocalHour' in clean || 'notifyTimezone' in clean
        || 'notifyReminderEnabled' in clean || 'notifyFrequency' in clean || 'notifyPausedUntil' in clean) {
      await this.scheduleService.rescheduleForUser(uid(req));
    }

    return { ok: true };
  }

  // ─── Practices ────────────────────────────────────────────────────────────

  @Get('practices')
  async getPractices(@Req() req: AuthRequest, @Query('needId') needId: string) {
    if (!NEED_IDS.includes(needId as NeedId)) throw new BadRequestException('Invalid needId');
    const rows = await this.botService.getPractices(uid(req), needId);
    return rows;
  }

  @Post('practices')
  async addPractice(@Req() req: AuthRequest, @Body() body: { needId: string; text: string }) {
    if (!NEED_IDS.includes(body.needId as NeedId) || !body.text?.trim()) throw new BadRequestException();
    const row = await this.botService.addPractice(uid(req), body.needId, body.text.trim().slice(0, 200));
    return row;
  }

  @Delete('practices/:id')
  async deletePractice(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.botService.deletePractice(uid(req), parseId(id));
    return { ok: true };
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  @Get('plan/pending')
  async getPendingPlans(@Req() req: AuthRequest) {
    const tz = (await this.botService.getUserSettings(uid(req)))?.notifyTimezone ?? 'Europe/Moscow';
    const today = this.localDate(tz);
    const plans = await this.botService.getPendingPlans(uid(req), today);
    return plans;
  }

  @Post('plan')
  async createPlan(
    @Req() req: AuthRequest,
    @Body() body: { needId: string; practiceText: string; reminderUtcHour?: number },
  ) {
    if (!NEED_IDS.includes(body.needId as NeedId) || !body.practiceText?.trim()) throw new BadRequestException();
    const settings = await this.botService.getUserSettings(uid(req));
    const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
    const tomorrow = this.localDate(tz, 1);
    const plan = await this.botService.createPlan(
      uid(req), body.needId, body.practiceText.trim(), tomorrow, body.reminderUtcHour,
    );
    if (body.reminderUtcHour !== undefined) {
      const sendAt = new Date();
      sendAt.setUTCDate(sendAt.getUTCDate() + 1);
      sendAt.setUTCHours(body.reminderUtcHour, 0, 0, 0);
      await this.notificationService.schedule(uid(req), 'practice_reminder', sendAt, {
        practiceText: body.practiceText.trim(),
        needId: body.needId,
        planId: plan.id,
      });
    }
    return plan;
  }

  @Post('plan/:id/checkin')
  async checkinPlan(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: { done: boolean }) {
    await this.botService.checkinPlan(uid(req), parseId(id), body.done);
    return { ok: true };
  }

  @Get('plans/history')
  async getPlanHistory(@Req() req: AuthRequest, @Query('days') days?: string) {
    const n = Math.min(Number(days) || 30, 90);
    return this.botService.getPlanHistory(uid(req), n);
  }

  // ─── Childhood Wheel ────────────────────────────────────────────────────────

  @Get('childhood-ratings')
  async getChildhoodRatings(@Req() req: AuthRequest) {
    return this.botService.getChildhoodRatings(uid(req));
  }

  @Post('childhood-ratings')
  async saveChildhoodRatings(@Req() req: AuthRequest, @Body() body: Record<string, number>) {
    const ratings: Record<string, number> = {};
    for (const needId of NEED_IDS) {
      if (typeof body[needId] === 'number' && Number.isInteger(body[needId]) && body[needId] >= 0 && body[needId] <= 10) {
        ratings[needId] = body[needId];
      }
    }
    if (Object.keys(ratings).length === 0) throw new BadRequestException('No valid ratings');
    await this.botService.saveChildhoodRatings(uid(req), ratings);
    return { ok: true };
  }

  // ─── YSQ Result ─────────────────────────────────────────────────────────────

  @Get('ysq-result')
  async getYsqResult(@Req() req: AuthRequest) {
    return this.botService.getYsqResult(uid(req));
  }

  @Post('ysq-result')
  async saveYsqResult(@Req() req: AuthRequest, @Body() body: { answers: number[] }) {
    if (!Array.isArray(body.answers) || body.answers.length !== 116) throw new BadRequestException('Invalid answers');
    if (!body.answers.every(a => Number.isInteger(a) && a >= 0 && a <= 6)) throw new BadRequestException('Invalid answer values');
    await this.botService.saveYsqResult(uid(req), body.answers);
    return { ok: true };
  }

  @Delete('ysq-result')
  async deleteYsqResult(@Req() req: AuthRequest) {
    await this.botService.deleteYsqResult(uid(req));
    return { ok: true };
  }

  @Get('ysq-history')
  async getYsqHistory(@Req() req: AuthRequest) {
    const raw = await this.botService.getYsqHistory(uid(req));
    return raw.map(r => ({
      id: r.id,
      completedAt: r.completedAt.toISOString(),
      scores: computeYsqScores(r.answers),
    }));
  }

  @Get('schema-notes')
  async getSchemaNotes(@Req() req: AuthRequest) {
    return this.botService.getSchemaNotes(uid(req));
  }

  @Post('schema-notes')
  async upsertSchemaNote(@Req() req: AuthRequest, @Body() body: {
    schemaId: string;
    triggers?: string; feelings?: string; thoughts?: string;
    origins?: string; reality?: string; healthyView?: string; behavior?: string;
  }) {
    if (!body.schemaId || typeof body.schemaId !== 'string') throw new BadRequestException('schemaId required');
    if (!/^[a-z_]{1,64}$/.test(body.schemaId)) throw new BadRequestException('invalid schemaId');
    const MAX = 3000;
    const fields = ['triggers', 'feelings', 'thoughts', 'origins', 'reality', 'healthyView', 'behavior'] as const;
    for (const f of fields) {
      if (body[f] !== undefined && (typeof body[f] !== 'string' || body[f]!.length > MAX))
        throw new BadRequestException(`${f} too long or invalid`);
    }
    return this.botService.upsertSchemaNote(uid(req), body.schemaId, {
      triggers: body.triggers?.trim(), feelings: body.feelings?.trim(), thoughts: body.thoughts?.trim(),
      origins: body.origins?.trim(), reality: body.reality?.trim(), healthyView: body.healthyView?.trim(),
      behavior: body.behavior?.trim(),
    });
  }

  @Get('mode-notes')
  async getModeNotes(@Req() req: AuthRequest) {
    return this.botService.getModeNotes(uid(req));
  }

  @Post('mode-notes')
  async upsertModeNote(@Req() req: AuthRequest, @Body() body: {
    modeId: string;
    triggers?: string; feelings?: string; thoughts?: string;
    needs?: string; behavior?: string;
  }) {
    if (!body.modeId || typeof body.modeId !== 'string') throw new BadRequestException('modeId required');
    if (!/^[a-z_]{1,64}$/.test(body.modeId)) throw new BadRequestException('invalid modeId');
    const MAX = 3000;
    const fields = ['triggers', 'feelings', 'thoughts', 'needs', 'behavior'] as const;
    for (const f of fields) {
      if (body[f] !== undefined && (typeof body[f] !== 'string' || body[f]!.length > MAX))
        throw new BadRequestException(`${f} too long or invalid`);
    }
    return this.botService.upsertModeNote(uid(req), body.modeId, {
      triggers: body.triggers?.trim(), feelings: body.feelings?.trim(), thoughts: body.thoughts?.trim(),
      needs: body.needs?.trim(), behavior: body.behavior?.trim(),
    });
  }

  // ── Belief checks ─────────────────────────────────────────────────────────────

  @Get('belief-checks')
  getBeliefChecks(@Req() req: AuthRequest) {
    return this.botService.getBeliefChecks(uid(req));
  }

  @Post('belief-checks')
  async createBeliefCheck(@Req() req: AuthRequest, @Body() body: { belief?: string; evidenceFor?: unknown; evidenceAgainst?: unknown; reframe?: string }) {
    const MAX = 3000;
    if (!body.belief || typeof body.belief !== 'string' || body.belief.length > MAX) throw new BadRequestException('invalid belief');
    if (!Array.isArray(body.evidenceFor) || !body.evidenceFor.every(s => typeof s === 'string' && s.length <= MAX)) throw new BadRequestException('invalid evidenceFor');
    if (!Array.isArray(body.evidenceAgainst) || !body.evidenceAgainst.every(s => typeof s === 'string' && s.length <= MAX)) throw new BadRequestException('invalid evidenceAgainst');
    if (body.reframe !== undefined && (typeof body.reframe !== 'string' || body.reframe.length > MAX)) throw new BadRequestException('invalid reframe');
    return this.botService.createBeliefCheck(uid(req), {
      belief: body.belief.trim(),
      evidenceFor: (body.evidenceFor as string[]).map(s => s.trim()).filter(Boolean),
      evidenceAgainst: (body.evidenceAgainst as string[]).map(s => s.trim()).filter(Boolean),
      reframe: body.reframe?.trim() || undefined,
    });
  }

  @Delete('belief-checks/:id')
  deleteBeliefCheck(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.botService.deleteBeliefCheck(uid(req), parseId(id));
  }

  // ── Letters ───────────────────────────────────────────────────────────────────

  @Get('letters')
  getLetters(@Req() req: AuthRequest) {
    return this.botService.getLetters(uid(req));
  }

  @Post('letters')
  async createLetter(@Req() req: AuthRequest, @Body() body: { text?: string }) {
    if (!body.text || typeof body.text !== 'string' || body.text.length > 10000) throw new BadRequestException('invalid text');
    return this.botService.createLetter(uid(req), body.text.trim());
  }

  @Delete('letters/:id')
  deleteLetter(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.botService.deleteLetter(uid(req), parseId(id));
  }

  // ── Safe place ────────────────────────────────────────────────────────────────

  @Get('safe-place')
  getSafePlace(@Req() req: AuthRequest) {
    return this.botService.getSafePlace(uid(req));
  }

  @Post('safe-place')
  async upsertSafePlace(@Req() req: AuthRequest, @Body() body: { description?: string }) {
    if (!body.description || typeof body.description !== 'string' || body.description.length > 10000) throw new BadRequestException('invalid description');
    return this.botService.upsertSafePlace(uid(req), body.description.trim());
  }

  // ── Flashcards ────────────────────────────────────────────────────────────────

  @Get('flashcards')
  getFlashcards(@Req() req: AuthRequest) {
    return this.botService.getFlashcards(uid(req));
  }

  @Post('flashcards')
  async createFlashcard(@Req() req: AuthRequest, @Body() body: { modeId?: string; needId?: string; reflection?: string; action?: string }) {
    const MAX = 3000;
    if (!body.modeId || typeof body.modeId !== 'string' || !/^[a-z_]{1,64}$/.test(body.modeId)) throw new BadRequestException('invalid modeId');
    if (!body.needId || typeof body.needId !== 'string' || !NEED_IDS.includes(body.needId as NeedId) && body.needId !== 'detached' && body.needId !== 'critic') throw new BadRequestException('invalid needId');
    if (body.reflection !== undefined && (typeof body.reflection !== 'string' || body.reflection.length > MAX)) throw new BadRequestException('invalid reflection');
    if (body.action !== undefined && (typeof body.action !== 'string' || body.action.length > MAX)) throw new BadRequestException('invalid action');
    return this.botService.createFlashcard(uid(req), {
      modeId: body.modeId,
      needId: body.needId,
      reflection: body.reflection?.trim() || undefined,
      action: body.action?.trim() || undefined,
    });
  }

  @Delete('flashcards/:id')
  deleteFlashcard(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.botService.deleteFlashcard(uid(req), parseId(id));
  }

  // ── Therapist: client notes ───────────────────────────────────────────────────

  @Get('therapy/client/:clientId/schema-notes')
  async getClientSchemaNotes(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const notes = await this.botService.getClientSchemaNotes(uid(req), BigInt(parseId(clientId)));
    if (!notes) throw new BadRequestException('relation not found');
    return notes;
  }

  @Get('therapy/client/:clientId/mode-notes')
  async getClientModeNotes(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const notes = await this.botService.getClientModeNotes(uid(req), BigInt(parseId(clientId)));
    if (!notes) throw new BadRequestException('relation not found');
    return notes;
  }

  @Delete('user')
  async deleteUser(@Req() req: AuthRequest) {
    await this.botService.deleteAllUserData(uid(req));
    return { ok: true };
  }

  private localDate(tz: string, daysAhead = 0): string {
    const d = new Date(Date.now() + daysAhead * 86_400_000);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
  }
}
