import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { TelegramAuthGuard } from './telegram-auth.guard';

interface AuthRequest extends Request {
  telegramUserId: number;
}

@Controller('api')
@UseGuards(TelegramAuthGuard)
export class ApiController {
  constructor(
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
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

  @Get('settings')
  async getSettings(@Req() req: AuthRequest) {
    const s = await this.botService.getUserSettings(req.telegramUserId);
    return {
      notifyEnabled: s?.notifyEnabled ?? true,
      notifyUtcHour: s?.notifyUtcHour ?? 19,
      notifyTzOffset: s?.notifyTzOffset ?? 2,
    };
  }

  @Post('settings')
  async updateSettings(
    @Req() req: AuthRequest,
    @Body() body: { notifyEnabled?: boolean; notifyUtcHour?: number; notifyTzOffset?: number },
  ) {
    await this.botService.updateUserSettings(req.telegramUserId, body);
    return { ok: true };
  }
}
