import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { NotificationService } from '../notification/notification.service';
import { buildSummaryText } from '../notification/notification.templates';

interface AuthRequest extends Request {
  telegramUserId: number;
}

@Controller('api')
@UseGuards(TelegramAuthGuard)
export class ApiController {
  constructor(
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly notificationService: NotificationService,
  ) {}

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
  async saveRating(@Req() req: AuthRequest, @Body() body: { needId: string; value: number }) {
    if (!NEED_IDS.includes(body.needId as NeedId) || !Number.isInteger(body.value) || body.value < 0 || body.value > 10) {
      throw new BadRequestException('Invalid needId or value');
    }
    await this.botService.saveRating(req.telegramUserId, body.needId as NeedId, body.value);

    // Check if all needs are now rated today → trigger diary-complete logic
    const ratings = await this.botService.getRatings(req.telegramUserId);
    const allDone = NEED_IDS.every(id => ratings[id] !== undefined);
    if (allDone) {
      await this.onDiaryComplete(req.telegramUserId, ratings);
    }

    return { ok: true };
  }

  private async onDiaryComplete(userId: number, ratings: Partial<Record<NeedId, number>>) {
    await this.notificationService.cancel(userId, 'reminder');
    await this.notificationService.cancel(userId, 'pre_reminder');

    const settings = await this.botService.getUserSettings(userId);
    const tzOffset = settings?.notifyTzOffset ?? 0;
    const notifyUtcHour = settings?.notifyUtcHour ?? 19;
    const text = buildSummaryText(this.botService.getNeeds(), ratings, tzOffset);

    if (!await this.notificationService.hasPending(userId, 'summary')) {
      const sendAt = new Date();
      sendAt.setUTCHours(notifyUtcHour, 0, 0, 0);
      if (sendAt <= new Date()) sendAt.setTime(Date.now());
      await this.notificationService.schedule(userId, 'summary', sendAt, { text });
    }

    const streak = await this.analyticsService.getConsecutiveDays(userId);
    for (const days of [7, 14, 30] as const) {
      if (streak === days && !await this.notificationService.hasPending(userId, `streak_${days}`)) {
        await this.notificationService.schedule(userId, `streak_${days}`, new Date());
      }
    }

    const total = await this.analyticsService.getTotalDaysFilled(userId);
    for (const days of [1, 3, 7] as const) {
      if (total === days && !await this.notificationService.hasPending(userId, `onboarding_${days}`)) {
        await this.notificationService.schedule(userId, `onboarding_${days}`, new Date());
      }
    }

    for (const days of [30, 60, 90] as const) {
      if (total === days && !await this.notificationService.hasPending(userId, `anniversary_${days}`)) {
        await this.notificationService.schedule(userId, `anniversary_${days}`, new Date());
      }
    }
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

  @Get('export')
  async getExport(@Req() req: AuthRequest) {
    const [history, streak] = await Promise.all([
      this.analyticsService.getHistoryRatings(req.telegramUserId, 30),
      this.analyticsService.getStreakData(req.telegramUserId),
    ]);
    const needs = this.botService.getNeeds();
    const lines: string[] = [`📔 Дневник потребностей · последние ${history.length} дней`, ''];
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
    return this.analyticsService.getAchievements(req.telegramUserId);
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
    const pair = await this.botService.getUserPair(req.telegramUserId);
    if (!pair || !pair.partnerId) {
      return { paired: false, partnerIndex: null, partnerTodayDone: false, code: pair?.code ?? null };
    }
    const partnerRatings = await this.botService.getRatings(pair.partnerId);
    const values = Object.values(partnerRatings);
    const partnerIndex = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
    return {
      paired: true,
      partnerIndex: partnerIndex !== null ? Math.round(partnerIndex * 10) / 10 : null,
      partnerTodayDone: values.length === 5,
      code: pair.code,
    };
  }

  @Post('pair/invite')
  async createPairInvite(@Req() req: AuthRequest) {
    const code = await this.botService.createPairInvite(req.telegramUserId);
    const url = `https://t.me/Emotional_Needs_bot?start=pair_${code}`;
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
  async leavePair(@Req() req: AuthRequest) {
    await this.botService.leavePair(req.telegramUserId);
    return { ok: true };
  }

  @Get('settings')
  async getSettings(@Req() req: AuthRequest) {
    const s = await this.botService.getUserSettings(req.telegramUserId);
    return {
      notifyEnabled: s?.notifyEnabled ?? true,
      notifyUtcHour: s?.notifyUtcHour ?? 19,
      notifyTzOffset: s?.notifyTzOffset ?? 2,
      notifyReminderEnabled: s?.notifyReminderEnabled ?? true,
    };
  }

  @Post('settings')
  async updateSettings(
    @Req() req: AuthRequest,
    @Body() body: { notifyEnabled?: boolean; notifyUtcHour?: number; notifyTzOffset?: number; notifyReminderEnabled?: boolean },
  ) {
    await this.botService.updateUserSettings(req.telegramUserId, body);

    // Reschedule reminder if notification time/toggle changed
    if ('notifyEnabled' in body || 'notifyUtcHour' in body || 'notifyTzOffset' in body) {
      const s = await this.botService.getUserSettings(req.telegramUserId);
      await this.notificationService.cancel(req.telegramUserId, 'reminder');
      if (s?.notifyEnabled) {
        const now = new Date();
        const sendAt = new Date(now);
        sendAt.setUTCHours(s.notifyUtcHour, 0, 0, 0);
        if (sendAt <= now) sendAt.setUTCDate(sendAt.getUTCDate() + 1);
        await this.notificationService.schedule(req.telegramUserId, 'reminder', sendAt);
      }
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
    await this.botService.deletePractice(req.telegramUserId, Number(id));
    return { ok: true };
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  @Get('plan/pending')
  async getPendingPlans(@Req() req: AuthRequest) {
    const tzOffset = (await this.botService.getUserSettings(req.telegramUserId))?.notifyTzOffset ?? 0;
    const today = this.localDate(tzOffset);
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
    const tzOffset = settings?.notifyTzOffset ?? 0;
    const tomorrow = this.localDate(tzOffset, 1);
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
    await this.botService.checkinPlan(req.telegramUserId, Number(id), body.done);
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

  @Delete('user')
  async deleteUser(@Req() req: AuthRequest) {
    await this.botService.deleteAllUserData(req.telegramUserId);
    return { ok: true };
  }

  private localDate(tzOffsetHours: number, daysAhead = 0): string {
    const d = new Date(Date.now() + tzOffsetHours * 3_600_000 + daysAhead * 86_400_000);
    return d.toISOString().split('T')[0];
  }
}
