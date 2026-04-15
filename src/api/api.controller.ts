import { BadRequestException, Body, Controller, Delete, Get, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { ProfileService } from '../bot/profile.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { NotificationService } from '../notification/notification.service';
import { TelegramScheduleService } from '../telegram/telegram.schedule.service';
import { TherapyService } from '../therapy/therapy.service';
import { VALID_TIMEZONES } from '../telegram/telegram.constants';

interface AuthRequest extends Request {
  telegramUserId: number;
  telegramFirstName?: string;
}

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
  ) {}

  @Get('profile')
  async getProfile(@Req() req: AuthRequest) {
    return this.profileService.getProfile(req.telegramUserId);
  }

  @Post('profile/name')
  async updateName(@Req() req: AuthRequest, @Body() body: { name: string }) {
    const name = body.name?.trim();
    if (!name || name.length > 50) throw new BadRequestException('Invalid name');
    await this.botService.updateName(req.telegramUserId, name);
    return { ok: true };
  }

  @Post('init')
  async init(@Req() req: AuthRequest, @Body() body: { timezone?: string }) {
    await this.botService.registerUser(req.telegramUserId, req.telegramFirstName, body.timezone);
    return { ok: true };
  }

  // ─── Disclaimer ─────────────────────────────────────────────────────────────

  @Get('disclaimer')
  async getDisclaimer(@Req() req: AuthRequest) {
    const accepted = await this.botService.hasAcceptedDisclaimer(req.telegramUserId);
    return { accepted };
  }

  @Post('disclaimer')
  async acceptDisclaimer(@Req() req: AuthRequest) {
    await this.botService.acceptDisclaimer(req.telegramUserId);
    return { ok: true };
  }

  // ─── YSQ Progress ────────────────────────────────────────────────────────────

  @Get('ysq-progress')
  async getYsqProgress(@Req() req: AuthRequest) {
    return this.botService.getYsqProgress(req.telegramUserId);
  }

  @Post('ysq-progress')
  async saveYsqProgress(@Req() req: AuthRequest, @Body() body: { answers: number[]; page: number }) {
    if (!Array.isArray(body.answers) || body.answers.length !== 116) throw new BadRequestException('Invalid answers');
    if (!Number.isInteger(body.page) || body.page < 0) throw new BadRequestException('Invalid page');
    await this.botService.saveYsqProgress(req.telegramUserId, body.answers, body.page);
    return { ok: true };
  }

  @Delete('ysq-progress')
  async deleteYsqProgress(@Req() req: AuthRequest) {
    await this.botService.deleteYsqProgress(req.telegramUserId);
    return { ok: true };
  }

  @Get('needs')
  getNeeds() {
    return this.botService.getNeeds();
  }

  @Get('ratings')
  async getRatings(@Req() req: AuthRequest, @Query('date') date?: string) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Invalid date format');
    return this.botService.getRatings(req.telegramUserId, date);
  }

  @Post('rating')
  async saveRating(@Req() req: AuthRequest, @Body() body: { needId: string; value: number; date?: string }) {
    if (!NEED_IDS.includes(body.needId as NeedId) || !Number.isInteger(body.value) || body.value < 0 || body.value > 10) {
      throw new BadRequestException('Invalid needId or value');
    }
    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new BadRequestException('Invalid date');
    await this.botService.saveRating(req.telegramUserId, body.needId as NeedId, body.value, body.date);
    this.therapyService.checkStreakTasks(req.telegramUserId).catch(() => null);

    // Skip diary-complete logic for historical backfill
    if (body.date) return { ok: true, allDone: false };

    // Check if all needs are now rated today → trigger diary-complete logic
    const ratings = await this.botService.getRatings(req.telegramUserId);
    const allDone = NEED_IDS.every(id => ratings[id] !== undefined);
    if (allDone) {
      const [streak] = await Promise.all([
        this.analyticsService.getStreakData(req.telegramUserId),
        this.scheduleService.onDiaryComplete(req.telegramUserId).catch((err) => {
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
    return this.analyticsService.getHistoryRatings(req.telegramUserId, n);
  }

  @Get('streak')
  async getStreak(@Req() req: AuthRequest) {
    return this.analyticsService.getStreakData(req.telegramUserId);
  }

  @Post('activity')
  async recordActivity(@Req() req: AuthRequest) {
    return this.analyticsService.recordActivity(req.telegramUserId);
  }

  @Get('export')
  async getExport(@Req() req: AuthRequest) {
    const [history, streak] = await Promise.all([
      this.analyticsService.getHistoryRatings(req.telegramUserId, 30),
      this.analyticsService.getStreakData(req.telegramUserId),
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
      this.analyticsService.getWeeklyStats(req.telegramUserId),
      this.analyticsService.getBestDayOfWeek(req.telegramUserId),
      this.analyticsService.getWorstDayOfWeek(req.telegramUserId),
      this.analyticsService.getStreakData(req.telegramUserId),
    ]);
    return { weeklyStats, bestDayOfWeek, worstDayOfWeek, totalDays: streak.totalDays };
  }

  @Get('achievements')
  async getAchievements(@Req() req: AuthRequest) {
    const [achievements, pairs] = await Promise.all([
      this.analyticsService.getAchievements(req.telegramUserId),
      this.botService.getUserPairs(req.telegramUserId),
    ]);
    const hasPair = pairs.some(p => p.status === 'active');
    return [...achievements, { id: 'pair_connected', earned: hasPair }];
  }

  @Get('note')
  async getNote(@Req() req: AuthRequest, @Query('date') date: string) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Invalid date format');
    return this.botService.getNote(req.telegramUserId, date);
  }

  @Post('note')
  async saveNote(@Req() req: AuthRequest, @Body() body: { date: string; text: string; tags?: string[] }) {
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || typeof body.text !== 'string') throw new BadRequestException();
    await this.botService.saveNote(req.telegramUserId, body.date, body.text.slice(0, 500), body.tags);
    return { ok: true };
  }

  @Get('pair')
  async getPair(@Req() req: AuthRequest) {
    const pairs = await this.botService.getUserPairs(req.telegramUserId);
    const activePairs = pairs.filter(p => p.status === 'active');
    const pendingPair = pairs.find(p => p.status === 'pending' && p.isCreator);

    const partners = await Promise.all(activePairs.map(async pair => {
      const [partnerRatings, partnerName, partnerHistory] = await Promise.all([
        this.botService.getRatings(pair.partnerId!),
        this.botService.getUserFirstName(pair.partnerId!),
        this.analyticsService.getHistoryRatings(pair.partnerId!, 7),
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
    const code = await this.botService.createPairInvite(req.telegramUserId);
    const url = `https://t.me/Emotional_Needs_bot/diary?startapp=pair_${code}`;
    return { code, url };
  }

  @Post('pair/join')
  async joinPair(@Req() req: AuthRequest, @Body() body: { code: string }) {
    if (!body.code || !/^[A-Z0-9]{5,12}$/i.test(body.code)) throw new BadRequestException('Invalid code format');
    const ok = await this.botService.joinPair(req.telegramUserId, body.code.toUpperCase());
    if (!ok) throw new BadRequestException('Invalid or expired code');
    return { ok: true };
  }

  @Delete('pair')
  async leavePair(@Req() req: AuthRequest, @Body() body: { code: string }) {
    if (!body.code) throw new BadRequestException('Code required');
    await this.botService.leavePair(req.telegramUserId, body.code);
    return { ok: true };
  }

  @Get('settings')
  async getSettings(@Req() req: AuthRequest) {
    const s = await this.botService.getUserSettings(req.telegramUserId);
    return {
      notifyEnabled: s?.notifyEnabled ?? true,
      notifyLocalHour: s?.notifyLocalHour ?? 21,
      notifyTimezone: s?.notifyTimezone ?? 'Europe/Moscow',
      notifyReminderEnabled: s?.notifyReminderEnabled ?? true,
      pairCardDismissed: s?.pairCardDismissed ?? false,
      mySchemaIds: (s?.mySchemaIds as string[] | null) ?? [],
      myModeIds: (s?.myModeIds as string[] | null) ?? [],
    };
  }

  @Post('settings')
  async updateSettings(
    @Req() req: AuthRequest,
    @Body() body: { notifyEnabled?: boolean; notifyLocalHour?: number; notifyTimezone?: string; notifyReminderEnabled?: boolean; pairCardDismissed?: boolean; mySchemaIds?: string[]; myModeIds?: string[] },
  ) {
    const clean: Parameters<typeof this.botService.updateUserSettings>[1] = {};
    if (typeof body.notifyEnabled === 'boolean') clean.notifyEnabled = body.notifyEnabled;
    if (typeof body.notifyReminderEnabled === 'boolean') clean.notifyReminderEnabled = body.notifyReminderEnabled;
    if (typeof body.pairCardDismissed === 'boolean') clean.pairCardDismissed = body.pairCardDismissed;
    if (Number.isInteger(body.notifyLocalHour) && body.notifyLocalHour! >= 0 && body.notifyLocalHour! <= 23) clean.notifyLocalHour = body.notifyLocalHour;
    if (typeof body.notifyTimezone === 'string' && VALID_TIMEZONES.includes(body.notifyTimezone)) clean.notifyTimezone = body.notifyTimezone;
    if (Array.isArray(body.mySchemaIds) && body.mySchemaIds.every(id => typeof id === 'string' && id.length < 100)) clean.mySchemaIds = body.mySchemaIds;
    if (Array.isArray(body.myModeIds) && body.myModeIds.every(id => typeof id === 'string' && id.length < 100)) clean.myModeIds = body.myModeIds;
    await this.botService.updateUserSettings(req.telegramUserId, clean);

    // Reschedule reminder if notification time/toggle changed
    if ('notifyEnabled' in clean || 'notifyLocalHour' in clean || 'notifyTimezone' in clean || 'notifyReminderEnabled' in clean) {
      await this.scheduleService.rescheduleForUser(req.telegramUserId);
    }

    return { ok: true };
  }

  // ─── Practices ────────────────────────────────────────────────────────────

  @Get('practices')
  async getPractices(@Req() req: AuthRequest, @Query('needId') needId: string) {
    if (!NEED_IDS.includes(needId as NeedId)) throw new BadRequestException('Invalid needId');
    const rows = await this.botService.getPractices(req.telegramUserId, needId);
    return rows;
  }

  @Post('practices')
  async addPractice(@Req() req: AuthRequest, @Body() body: { needId: string; text: string }) {
    if (!NEED_IDS.includes(body.needId as NeedId) || !body.text?.trim()) throw new BadRequestException();
    const row = await this.botService.addPractice(req.telegramUserId, body.needId, body.text.trim().slice(0, 200));
    return row;
  }

  @Delete('practices/:id')
  async deletePractice(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.botService.deletePractice(req.telegramUserId, parseId(id));
    return { ok: true };
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  @Get('plan/pending')
  async getPendingPlans(@Req() req: AuthRequest) {
    const tz = (await this.botService.getUserSettings(req.telegramUserId))?.notifyTimezone ?? 'Europe/Moscow';
    const today = this.localDate(tz);
    const plans = await this.botService.getPendingPlans(req.telegramUserId, today);
    return plans;
  }

  @Post('plan')
  async createPlan(
    @Req() req: AuthRequest,
    @Body() body: { needId: string; practiceText: string; reminderUtcHour?: number },
  ) {
    if (!NEED_IDS.includes(body.needId as NeedId) || !body.practiceText?.trim()) throw new BadRequestException();
    const settings = await this.botService.getUserSettings(req.telegramUserId);
    const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
    const tomorrow = this.localDate(tz, 1);
    const plan = await this.botService.createPlan(
      req.telegramUserId, body.needId, body.practiceText.trim(), tomorrow, body.reminderUtcHour,
    );
    if (body.reminderUtcHour !== undefined) {
      const sendAt = new Date();
      sendAt.setUTCDate(sendAt.getUTCDate() + 1);
      sendAt.setUTCHours(body.reminderUtcHour, 0, 0, 0);
      await this.notificationService.schedule(req.telegramUserId, 'practice_reminder', sendAt, {
        practiceText: body.practiceText.trim(),
        needId: body.needId,
        planId: plan.id,
      });
    }
    return plan;
  }

  @Post('plan/:id/checkin')
  async checkinPlan(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: { done: boolean }) {
    await this.botService.checkinPlan(req.telegramUserId, parseId(id), body.done);
    return { ok: true };
  }

  @Get('plans/history')
  async getPlanHistory(@Req() req: AuthRequest, @Query('days') days?: string) {
    const n = Math.min(Number(days) || 30, 90);
    return this.botService.getPlanHistory(req.telegramUserId, n);
  }

  // ─── Childhood Wheel ────────────────────────────────────────────────────────

  @Get('childhood-ratings')
  async getChildhoodRatings(@Req() req: AuthRequest) {
    return this.botService.getChildhoodRatings(req.telegramUserId);
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
    await this.botService.saveChildhoodRatings(req.telegramUserId, ratings);
    return { ok: true };
  }

  // ─── YSQ Result ─────────────────────────────────────────────────────────────

  @Get('ysq-result')
  async getYsqResult(@Req() req: AuthRequest) {
    return this.botService.getYsqResult(req.telegramUserId);
  }

  @Post('ysq-result')
  async saveYsqResult(@Req() req: AuthRequest, @Body() body: { answers: number[] }) {
    if (!Array.isArray(body.answers) || body.answers.length !== 116) throw new BadRequestException('Invalid answers');
    if (!body.answers.every(a => Number.isInteger(a) && a >= 0 && a <= 6)) throw new BadRequestException('Invalid answer values');
    await this.botService.saveYsqResult(req.telegramUserId, body.answers);
    return { ok: true };
  }

  @Delete('ysq-result')
  async deleteYsqResult(@Req() req: AuthRequest) {
    await this.botService.deleteYsqResult(req.telegramUserId);
    return { ok: true };
  }

  @Get('schema-notes')
  async getSchemaNotes(@Req() req: AuthRequest) {
    return this.botService.getSchemaNotes(req.telegramUserId);
  }

  @Post('schema-notes')
  async upsertSchemaNote(@Req() req: AuthRequest, @Body() body: {
    schemaId: string;
    triggers?: string; feelings?: string; thoughts?: string;
    origins?: string; reality?: string; healthyView?: string; behavior?: string;
  }) {
    if (!body.schemaId) throw new BadRequestException('schemaId required');
    return this.botService.upsertSchemaNote(req.telegramUserId, body.schemaId, {
      triggers: body.triggers, feelings: body.feelings, thoughts: body.thoughts,
      origins: body.origins, reality: body.reality, healthyView: body.healthyView,
      behavior: body.behavior,
    });
  }

  @Get('mode-notes')
  async getModeNotes(@Req() req: AuthRequest) {
    return this.botService.getModeNotes(req.telegramUserId);
  }

  @Post('mode-notes')
  async upsertModeNote(@Req() req: AuthRequest, @Body() body: {
    modeId: string;
    triggers?: string; feelings?: string; thoughts?: string;
    needs?: string; behavior?: string;
  }) {
    if (!body.modeId) throw new BadRequestException('modeId required');
    return this.botService.upsertModeNote(req.telegramUserId, body.modeId, {
      triggers: body.triggers, feelings: body.feelings, thoughts: body.thoughts,
      needs: body.needs, behavior: body.behavior,
    });
  }

  @Delete('user')
  async deleteUser(@Req() req: AuthRequest) {
    await this.botService.deleteAllUserData(req.telegramUserId);
    return { ok: true };
  }

  private localDate(tz: string, daysAhead = 0): string {
    const d = new Date(Date.now() + daysAhead * 86_400_000);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
  }
}
