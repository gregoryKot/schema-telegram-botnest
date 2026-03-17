import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { NotificationService } from '../notification/notification.service';

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
    return this.botService.getRatings(req.telegramUserId, date);
  }

  @Post('rating')
  async saveRating(@Req() req: AuthRequest, @Body() body: { needId: string; value: number }) {
    if (!NEED_IDS.includes(body.needId as NeedId) || !Number.isInteger(body.value) || body.value < 0 || body.value > 10) {
      throw new BadRequestException('Invalid needId or value');
    }
    await this.botService.saveRating(req.telegramUserId, body.needId as NeedId, body.value);
    return { ok: true };
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

  @Get('insights')
  async getInsights(@Req() req: AuthRequest) {
    const [weeklyStats, bestDayOfWeek, streak] = await Promise.all([
      this.analyticsService.getWeeklyStats(req.telegramUserId),
      this.analyticsService.getBestDayOfWeek(req.telegramUserId),
      this.analyticsService.getStreakData(req.telegramUserId),
    ]);
    return { weeklyStats, bestDayOfWeek, totalDays: streak.totalDays };
  }

  @Get('achievements')
  async getAchievements(@Req() req: AuthRequest) {
    return this.analyticsService.getAchievements(req.telegramUserId);
  }

  @Get('note')
  async getNote(@Req() req: AuthRequest, @Query('date') date: string) {
    const text = await this.botService.getNote(req.telegramUserId, date);
    return { text };
  }

  @Post('note')
  async saveNote(@Req() req: AuthRequest, @Body() body: { date: string; text: string }) {
    if (!body.date || typeof body.text !== 'string') throw new BadRequestException();
    await this.botService.saveNote(req.telegramUserId, body.date, body.text.slice(0, 500));
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

    // Reschedule today's reminders if notification time/toggle changed
    if ('notifyEnabled' in body || 'notifyUtcHour' in body || 'notifyTzOffset' in body || 'notifyReminderEnabled' in body) {
      const s = await this.botService.getUserSettings(req.telegramUserId);
      await this.notificationService.cancel(req.telegramUserId, 'reminder');
      await this.notificationService.cancel(req.telegramUserId, 'pre_reminder');
      if (s?.notifyEnabled) {
        const now = new Date();
        const sendAt = new Date(now);
        sendAt.setUTCHours(s.notifyUtcHour, 0, 0, 0);
        if (sendAt <= now) sendAt.setUTCDate(sendAt.getUTCDate() + 1);
        await this.notificationService.schedule(req.telegramUserId, 'reminder', sendAt);
        if (s.notifyReminderEnabled) {
          const preAt = new Date(sendAt);
          preAt.setUTCHours(((s.notifyUtcHour - 1) + 24) % 24, 0, 0, 0);
          if (preAt < sendAt) preAt.setUTCDate(preAt.getUTCDate() + 1);
          await this.notificationService.schedule(req.telegramUserId, 'pre_reminder', preAt);
        }
      }
    }

    return { ok: true };
  }
}
