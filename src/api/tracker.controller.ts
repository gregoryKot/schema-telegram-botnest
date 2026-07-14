import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { uid } from './request-utils';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { PairsService } from '../bot/pairs.service';
import { TelegramScheduleService } from '../telegram/telegram.schedule.service';
import { TherapyTasksService } from '../therapy/therapy-tasks.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { SaveRatingDto } from './dto/ratings.dto';
import { SaveNoteDto } from './dto/notes.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Трекер потребностей: оценки дня, история/стрик/аналитика, дневная
// заметка и «детский» опросник (childhood wheel).
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class TrackerController {
  private readonly logger = new Logger(TrackerController.name);

  constructor(
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly pairsService: PairsService,
    private readonly scheduleService: TelegramScheduleService,
    private readonly tasksService: TherapyTasksService,
  ) {}

  @Get('needs')
  getNeeds() {
    return this.botService.getNeeds();
  }

  @Get('ratings')
  async getRatings(@Req() req: AuthRequest, @Query('date') date?: string) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new BadRequestException('Invalid date format');
    return this.botService.getRatings(uid(req), date);
  }

  @Post('rating')
  async saveRating(@Req() req: AuthRequest, @Body() body: SaveRatingDto) {
    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
      throw new BadRequestException('Invalid date');
    await this.botService.saveRating(
      uid(req),
      body.needId as NeedId,
      body.value,
      body.date,
    );
    this.tasksService
      .checkStreakTasks(uid(req))
      .catch((err) => this.logger.error('checkStreakTasks failed', err));

    // Skip diary-complete logic for historical backfill
    if (body.date) return { ok: true, allDone: false };

    // Check if all needs are now rated today → trigger diary-complete logic
    const ratings = await this.botService.getRatings(uid(req));
    const allDone = NEED_IDS.every((id) => ratings[id] !== undefined);
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
    const lines: string[] = [
      `📔 Трекер потребностей · последние ${history.length} дней`,
      '',
    ];
    for (const day of [...history].reverse()) {
      const vals = needs.map((n) => {
        const v = day.ratings[n.id];
        return v !== undefined ? `${n.emoji} ${v}/10` : `${n.emoji} –`;
      });
      lines.push(`${day.date}: ${vals.join('  ')}`);
    }
    lines.push('');
    lines.push(
      `Серия: ${streak.currentStreak} дн. · Рекорд: ${streak.longestStreak} · Всего: ${streak.totalDays}`,
    );
    return { text: lines.join('\n') };
  }

  @Get('insights')
  async getInsights(@Req() req: AuthRequest) {
    const [weeklyStats, bestDayOfWeek, worstDayOfWeek, streak] =
      await Promise.all([
        this.analyticsService.getWeeklyStats(uid(req)),
        this.analyticsService.getBestDayOfWeek(uid(req)),
        this.analyticsService.getWorstDayOfWeek(uid(req)),
        this.analyticsService.getStreakData(uid(req)),
      ]);
    return {
      weeklyStats,
      bestDayOfWeek,
      worstDayOfWeek,
      totalDays: streak.totalDays,
    };
  }

  @Get('achievements')
  async getAchievements(@Req() req: AuthRequest) {
    const [achievements, pairs] = await Promise.all([
      this.analyticsService.getAchievements(uid(req)),
      this.pairsService.getUserPairs(uid(req)),
    ]);
    const hasPair = pairs.some((p) => p.status === 'active');
    return [...achievements, { id: 'pair_connected', earned: hasPair }];
  }

  @Get('note')
  async getNote(@Req() req: AuthRequest, @Query('date') date: string) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new BadRequestException('Invalid date format');
    return this.botService.getNote(uid(req), date);
  }

  @Post('note')
  async saveNote(@Req() req: AuthRequest, @Body() body: SaveNoteDto) {
    if (
      !body.date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
      typeof body.text !== 'string'
    )
      throw new BadRequestException();
    await this.botService.saveNote(
      uid(req),
      body.date,
      body.text.slice(0, 500),
      body.tags,
    );
    return { ok: true };
  }

  // ─── Childhood Wheel ────────────────────────────────────────────────────────

  @Get('childhood-ratings')
  async getChildhoodRatings(@Req() req: AuthRequest) {
    return this.botService.getChildhoodRatings(uid(req));
  }

  @Post('childhood-ratings')
  async saveChildhoodRatings(
    @Req() req: AuthRequest,
    // Не DTO: map needId→value, ключи и значения валидируются ниже вручную
    // (сервис saveChildhoodRatings принимает их как есть, без проверки).
    @Body() body: Record<string, number>,
  ) {
    const ratings: Record<string, number> = {};
    for (const needId of NEED_IDS) {
      if (
        typeof body[needId] === 'number' &&
        Number.isInteger(body[needId]) &&
        body[needId] >= 0 &&
        body[needId] <= 10
      ) {
        ratings[needId] = body[needId];
      }
    }
    if (Object.keys(ratings).length === 0)
      throw new BadRequestException('No valid ratings');
    await this.botService.saveChildhoodRatings(uid(req), ratings);
    return { ok: true };
  }
}
