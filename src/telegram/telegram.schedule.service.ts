import { Injectable, Logger, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { NotificationService } from '../notification/notification.service';
import { renderTemplate, buildWeeklySummaryText, buildSummaryText, renderLowStreakInsight } from '../notification/notification.templates';

@Injectable()
export class TelegramScheduleService implements OnModuleInit {
  private readonly logger = new Logger(TelegramScheduleService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly notificationService: NotificationService,
  ) {}

  private isProcessing = false;

  async onModuleInit() {
    // Catch-up: if midnight cron was missed (deploy/restart), schedule any missing reminders.
    // Delay 10s so the bot is fully connected before we start sending.
    setTimeout(() => {
      this.scheduleDailyReminders().catch((e) =>
        this.logger.error('Startup reminder catch-up failed', e),
      );
    }, 10_000);
  }

  /** Every 5 minutes: send all due notifications from the queue */
  @Cron('*/5 * * * *')
  async processQueue() {
    if (!this.bot) return;
    if (this.isProcessing) {
      this.logger.warn('processQueue already running — skipping tick');
      return;
    }
    this.isProcessing = true;
    try {
      await this.runProcessQueue();
    } finally {
      this.isProcessing = false;
    }
  }

  private async runProcessQueue() {
    const due = await this.notificationService.getDue();
    if (due.length === 0) return;
    this.logger.log(`Processing ${due.length} due notifications`);

    for (const notif of due) {
      try {
        const payload = notif.payload as Record<string, unknown> | null;
        const template = renderTemplate(notif.type as any, payload ?? undefined);
        if (!template) {
          this.logger.warn(`No template for type=${notif.type} id=${notif.id} — skipping`);
          await this.notificationService.markSent(notif.id);
          continue;
        }
        const silent = notif.type === 'summary';
        const opts = {
          ...(template.keyboard ? { reply_markup: template.keyboard.reply_markup } : {}),
          ...(silent ? { disable_notification: true } : {}),
        };
        await this.bot.telegram.sendMessage(notif.userId, template.text, opts);
        await this.notificationService.markSent(notif.id);
      } catch (err: any) {
        const code = err?.response?.error_code;
        if (code === 403 || code === 400) {
          // Bot blocked or user deactivated — skip permanently
          this.logger.warn(`Skipping notification id=${notif.id} userId=${notif.userId} (Telegram ${code})`);
          await this.notificationService.markSent(notif.id);
          await this.botService.markUserBlocked(notif.userId);
        } else {
          this.logger.error(`Failed to send notification id=${notif.id} userId=${notif.userId}`, err);
        }
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
        await this.scheduleReminder(user.id, user.notifyUtcHour, user.notifyReminderEnabled);
        const isLapsing = await this.checkLapsingState(user.id, user.notifyUtcHour);
        if (!isLapsing) {
          await this.checkMissedPlans(user.id);
          await this.scheduleLowStreakInsight(user.id, user.notifyUtcHour);
        }
      } catch (err) {
        this.logger.error(`Midnight scheduler failed for userId=${user.id}`, err);
      }
    }
  }

  private async scheduleReminder(userId: number, notifyUtcHour: number, enabled = true) {
    if (!enabled) {
      await this.notificationService.cancel(userId, 'reminder');
      return;
    }
    // Smart payload: yesterday avg + lowest need + streak
    const [streak, weeklyStats, history] = await Promise.all([
      this.analyticsService.getConsecutiveDays(userId),
      this.analyticsService.getWeeklyStats(userId),
      this.analyticsService.getHistoryRatings(userId, 2),
    ]);
    const yesterday = history.find((_, i) => i === 1);
    const yesterdayAvg = yesterday
      ? Object.values(yesterday.ratings).reduce((s, v) => s + v, 0) / Object.values(yesterday.ratings).length
      : undefined;
    const lowest = weeklyStats.filter(s => s.avg !== null).sort((a, b) => (a.avg ?? 10) - (b.avg ?? 10))[0];
    const lowestNeed = lowest ? this.botService.getNeeds().find(n => n.id === lowest.needId)?.chartLabel : undefined;
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const variant = (userId + dayIndex) % 5;
    const payload = { streak, yesterdayAvg, lowestNeed, variant };

    const sendAt = this.nextSendAt(notifyUtcHour);

    // Always cancel stale reminders and reschedule fresh.
    // hasPending guard caused missed notifications: if a reminder survived from a
    // previous day (e.g. server was down at sendAt), the guard blocked scheduling
    // the next day's reminder entirely.
    await this.notificationService.cancel(userId, 'reminder');
    await this.notificationService.schedule(userId, 'reminder', sendAt, payload);

  }

  /** Returns true if a lapsing/dormant notification was scheduled (caller should skip other daily notifs) */
  private async checkLapsingState(userId: number, notifyUtcHour: number): Promise<boolean> {
    const days = await this.analyticsService.getDaysSinceLastFill(userId);
    const thresholds: Array<[number, 'lapsing_2' | 'lapsing_4' | 'dormant_7' | 'reengagement_30']> = [
      [2, 'lapsing_2'], [4, 'lapsing_4'], [7, 'dormant_7'], [30, 'reengagement_30'],
    ];
    for (const [d, type] of thresholds) {
      if (days === d) {
        const has = await this.notificationService.hasPending(userId, type);
        if (!has) {
          // Replace the regular reminder with the lapsing message — same purpose, better copy
          await this.notificationService.cancel(userId, 'reminder');
          await this.notificationService.schedule(userId, type, this.nextSendAt(notifyUtcHour));
        }
        return true;
      }
    }
    return false;
  }

  private async checkMissedPlans(userId: number) {
    const settings = await this.botService.getUserSettings(userId);
    const tzOffset = settings?.notifyTzOffset ?? 2;
    const notifyUtcHour = settings?.notifyUtcHour ?? 19;
    const d = new Date(Date.now() + tzOffset * 3_600_000 - 86_400_000);
    const yesterday = d.toISOString().split('T')[0];
    const missed = await this.botService.getMissedPlans(userId, yesterday);
    if (missed.length > 0 && !await this.notificationService.hasPending(userId, 'practice_missed')) {
      const text = missed.map(p => p.practiceText).join(', ');
      await this.notificationService.schedule(userId, 'practice_missed', this.nextSendAt(notifyUtcHour), { practiceText: text });
    }
  }

  async onDiaryComplete(userId: number) {
    await this.notificationService.cancel(userId, 'reminder');
    await this.notificationService.cancel(userId, 'pre_reminder');
    await this.notificationService.cancel(userId, 'low_streak_insight');

    const settings = await this.botService.getUserSettings(userId);
    const tzOffset = settings?.notifyTzOffset ?? 2;
    const notifyUtcHour = settings?.notifyUtcHour ?? 19;
    const ratings = await this.botService.getRatings(userId);
    const text = buildSummaryText(this.botService.getNeeds(), ratings, tzOffset);

    await this.notificationService.cancel(userId, 'summary');
    // Schedule summary after milestones: if notify hour passed, add 5 min so milestones (sent now)
    // arrive first and summary follows in the next processQueue cycle.
    const sendAt = new Date();
    sendAt.setUTCHours(notifyUtcHour, 0, 0, 0);
    if (sendAt <= new Date()) sendAt.setTime(Date.now() + 5 * 60_000);
    await this.notificationService.schedule(userId, 'summary', sendAt, { text });

    const streak = await this.analyticsService.getConsecutiveDays(userId);
    for (const days of [7, 14, 30] as const) {
      if (streak === days && !await this.notificationService.hasEver(userId, `streak_${days}`)) {
        await this.notificationService.schedule(userId, `streak_${days}`, new Date());
      }
    }

    const total = await this.analyticsService.getTotalDaysFilled(userId);
    for (const days of [1, 3, 7] as const) {
      if (total === days && !await this.notificationService.hasEver(userId, `onboarding_${days}`)) {
        await this.notificationService.schedule(userId, `onboarding_${days}`, new Date());
      }
    }
    for (const days of [30, 60, 90] as const) {
      if (total === days && !await this.notificationService.hasEver(userId, `anniversary_${days}`)) {
        await this.notificationService.schedule(userId, `anniversary_${days}`, new Date());
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
        // Skip dormant users — weekly summary is meaningless without recent data
        const daysSince = await this.analyticsService.getDaysSinceLastFill(user.id);
        if (daysSince < 0 || daysSince >= 7) continue;
        const stats = await this.analyticsService.getWeeklyStats(user.id);
        const bestDay = await this.analyticsService.getBestDayOfWeek(user.id);
        const text = buildWeeklySummaryText(stats, this.botService.getNeeds(), bestDay);
        await this.notificationService.schedule(user.id, 'weekly', this.nextSendAt(user.notifyUtcHour), { text });
      } catch (err) {
        this.logger.error(`Weekly summary failed for userId=${user.id}`, err);
      }
    }
  }

  /** Return sendAt clamped so it's never in the past. If it's passed, push to
   *  tomorrow at the same notifyUtcHour instead of firing +1 min at midnight. */
  private nextSendAt(notifyUtcHour: number): Date {
    const sendAt = new Date();
    sendAt.setUTCHours(notifyUtcHour, 0, 0, 0);
    if (sendAt <= new Date()) sendAt.setUTCDate(sendAt.getUTCDate() + 1);
    return sendAt;
  }

  private async scheduleLowStreakInsight(userId: number, notifyUtcHour: number) {
    const lowNeeds = await this.analyticsService.getLowStreakNeeds(userId, 5, 3);
    if (lowNeeds.length === 0) return;
    if (await this.notificationService.hasPending(userId, 'low_streak_insight')) return;

    const needs = this.botService.getNeeds();
    // Combine all low-streak needs into one message
    const lines = lowNeeds.map((needId) => {
      const need = needs.find((n) => n.id === needId)!;
      return renderLowStreakInsight(need.emoji, need.chartLabel).text;
    });
    const text = lines.join('\n\n');

    await this.notificationService.schedule(userId, 'low_streak_insight', this.nextSendAt(notifyUtcHour), { text });
  }
}
