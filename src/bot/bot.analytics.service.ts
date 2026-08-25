import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NeedId } from './bot.service';
import { RatingHistoryMetrics } from './bot.rating-history';
import { ActivityStreakMetrics } from './bot.activity-streak';
import { InsightMetrics } from './bot.insight-metrics';

// Фасад аналитики пользователя (правило №10: 477 строк → три модуля).
// Публичный API и сигнатура конструктора сохранены — ~30 колл-сайтов и
// специнстанцирования `new BotAnalyticsService(prisma)` не тронуты.
// Реализация: bot.rating-history.ts (история оценок/заполнение),
// bot.activity-streak.ts (активность из всех источников, стрики),
// bot.insight-metrics.ts (динамика, портрет, ачивки, дни недели).
@Injectable()
export class BotAnalyticsService {
  private readonly history: RatingHistoryMetrics;
  private readonly activity: ActivityStreakMetrics;
  private readonly insights: InsightMetrics;

  constructor(private readonly prisma: PrismaService) {
    this.history = new RatingHistoryMetrics(prisma);
    this.activity = new ActivityStreakMetrics(prisma);
    this.insights = new InsightMetrics(prisma, this.activity);
  }

  getHistoryRatings(userId: bigint, days: number, tzArg?: string) {
    return this.history.getHistoryRatings(userId, days, tzArg);
  }

  getLowStreakNeeds(
    userId: bigint,
    threshold: number,
    days: number,
    tzArg?: string,
  ): Promise<NeedId[]> {
    return this.history.getLowStreakNeeds(userId, threshold, days, tzArg);
  }

  getConsecutiveDays(userId: bigint, tzArg?: string): Promise<number> {
    return this.history.getConsecutiveDays(userId, tzArg);
  }

  getTotalDaysFilled(userId: bigint): Promise<number> {
    return this.history.getTotalDaysFilled(userId);
  }

  getDaysSinceLastFill(userId: bigint, tzArg?: string): Promise<number> {
    return this.history.getDaysSinceLastFill(userId, tzArg);
  }

  getFillDaysInLast(
    userId: bigint,
    days: number,
    tzArg?: string,
  ): Promise<number> {
    return this.history.getFillDaysInLast(userId, days, tzArg);
  }

  getGapBeforeLatestFill(userId: bigint): Promise<number | null> {
    return this.history.getGapBeforeLatestFill(userId);
  }

  getWeeklyStats(userId: bigint, tzArg?: string) {
    return this.insights.getWeeklyStats(userId, tzArg);
  }

  getProfileInsight(userId: bigint) {
    return this.insights.getProfileInsight(userId);
  }

  getAchievements(userId: bigint) {
    return this.insights.getAchievements(userId);
  }

  recordActivity(userId: bigint): Promise<{ ok: boolean }> {
    return this.activity.recordActivity(userId);
  }

  getStreakData(userId: bigint) {
    return this.activity.getStreakData(userId);
  }

  getDayOfWeekExtremes(userId: bigint) {
    return this.insights.getDayOfWeekExtremes(userId);
  }

  async getBestDayOfWeek(userId: bigint): Promise<string | null> {
    return (await this.insights.getDayOfWeekExtremes(userId)).best;
  }

  async getWorstDayOfWeek(userId: bigint): Promise<string | null> {
    return (await this.insights.getDayOfWeekExtremes(userId)).worst;
  }
}
