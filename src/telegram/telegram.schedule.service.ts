import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { NotificationService } from '../notification/notification.service';
import { renderTemplate, renderLowStreakInsight, buildWeeklySummaryText, buildSummaryText } from '../notification/notification.templates';

@Injectable()
export class TelegramScheduleService {
  private readonly logger = new Logger(TelegramScheduleService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly notificationService: NotificationService,
  ) {}

  /** Every 5 minutes: send all due notifications from the queue */
  @Cron('*/5 * * * *')
  async processQueue() {
    if (!this.bot) return;
    const due = await this.notificationService.getDue();
    if (due.length === 0) return;
    this.logger.log(`Processing ${due.length} due notifications`);

    for (const notif of due) {
      try {
        const payload = notif.payload as Record<string, unknown> | null;
        const template = renderTemplate(notif.type as any, payload ?? undefined);
        if (!template) {
          await this.notificationService.markSent(notif.id);
          continue;
        }
        const opts = template.keyboard ? { reply_markup: template.keyboard.reply_markup } : {};
        await this.bot.telegram.sendMessage(notif.userId, template.text, opts);
        await this.notificationService.markSent(notif.id);
      } catch (err) {
        this.logger.error(`Failed to send notification id=${notif.id} userId=${notif.userId}`, err);
      }
    }
  }

  /** Midnight UTC: schedule tomorrow's reminders + detect lapsing users */
  @Cron('0 0 * * *')
  async scheduleDailyReminders() {
    if (!this.bot) return;
    const users = await this.botService.getAllUsersWithSettings();
    this.logger.log(`Midnight scheduler: ${users.length} users`);

    for (const user of users) {
      try {
        await this.scheduleReminder(user.id, user.notifyUtcHour);
        await this.checkLapsingState(user.id);

      } catch (err) {
        this.logger.error(`Midnight scheduler failed for userId=${user.id}`, err);
      }
    }

    await this.sendLowStreakInsights();
  }

  private async scheduleReminder(userId: number, notifyUtcHour: number) {
    const hasPending = await this.notificationService.hasPending(userId, 'reminder');
    if (hasPending) return;
    const sendAt = new Date();
    sendAt.setUTCDate(sendAt.getUTCDate() + 1);
    sendAt.setUTCHours(notifyUtcHour, 0, 0, 0);
    await this.notificationService.schedule(userId, 'reminder', sendAt);
  }

  private async checkLapsingState(userId: number) {
    const days = await this.analyticsService.getDaysSinceLastFill(userId);
    const thresholds: Array<[number, 'lapsing_2' | 'lapsing_4' | 'dormant_7' | 'reengagement_30']> = [
      [2, 'lapsing_2'], [4, 'lapsing_4'], [7, 'dormant_7'], [30, 'reengagement_30'],
    ];
    for (const [d, type] of thresholds) {
      if (days === d) {
        const has = await this.notificationService.hasPending(userId, type);
        if (!has) await this.notificationService.schedule(userId, type, new Date());
        break;
      }
    }
  }

  async onDiaryComplete(userId: number) {
    await this.notificationService.cancel(userId, 'reminder');

    const settings = await this.botService.getUserSettings(userId);
    const tzOffset = settings?.notifyTzOffset ?? 0;
    const notifyUtcHour = settings?.notifyUtcHour ?? 19;
    const ratings = await this.botService.getRatings(userId);
    const text = buildSummaryText(this.botService.getNeeds(), ratings, tzOffset);

    const hasSummary = await this.notificationService.hasPending(userId, 'summary');
    if (!hasSummary) {
      const todaySummary = new Date();
      todaySummary.setUTCHours(notifyUtcHour, 0, 0, 0);
      const sendAt = todaySummary > new Date() ? todaySummary : new Date();
      await this.notificationService.schedule(userId, 'summary', sendAt, { text });
    }

    const streak = await this.analyticsService.getConsecutiveDays(userId);
    for (const days of [7, 14, 30] as const) {
      if (streak === days) {
        const has = await this.notificationService.hasPending(userId, `streak_${days}`);
        if (!has) await this.notificationService.schedule(userId, `streak_${days}`, new Date());
      }
    }

    const total = await this.analyticsService.getTotalDaysFilled(userId);
    for (const days of [1, 3, 7] as const) {
      if (total === days) {
        const has = await this.notificationService.hasPending(userId, `onboarding_${days}`);
        if (!has) await this.notificationService.schedule(userId, `onboarding_${days}`, new Date());
      }
    }
  }

  /** Sunday midnight UTC: schedule weekly summary for each user */
  @Cron('0 0 * * 0')
  async scheduleWeeklySummaries() {
    if (!this.bot) return;
    const users = await this.botService.getAllUsersWithSettings();
    this.logger.log(`Sunday scheduler: ${users.length} users`);

    for (const user of users) {
      try {
        if (await this.notificationService.hasPending(user.id, 'weekly')) continue;
        const stats = await this.analyticsService.getWeeklyStats(user.id);
        const bestDay = await this.analyticsService.getBestDayOfWeek(user.id);
        const text = buildWeeklySummaryText(stats, this.botService.getNeeds(), bestDay);
        const sendAt = new Date();
        sendAt.setUTCHours(user.notifyUtcHour, 0, 0, 0);
        await this.notificationService.schedule(user.id, 'weekly', sendAt, { text });
      } catch (err) {
        this.logger.error(`Weekly summary failed for userId=${user.id}`, err);
      }
    }
  }

  private async sendLowStreakInsights() {
    if (!this.bot) return;
    const userIds = await this.botService.getAllUserIds();
    for (const userId of userIds) {
      try {
        const lowNeeds = await this.analyticsService.getLowStreakNeeds(userId, 5, 3);
        if (lowNeeds.length === 0) continue;
        const needs = this.botService.getNeeds();
        for (const needId of lowNeeds) {
          const need = needs.find((n) => n.id === needId)!;
          const template = renderLowStreakInsight(need.emoji, need.chartLabel);
          await this.bot.telegram.sendMessage(userId, template.text, {
            reply_markup: template.keyboard!.reply_markup,
          });
        }
      } catch (err) {
        this.logger.error(`Low streak insight failed for userId=${userId}`, err);
      }
    }
  }
}
