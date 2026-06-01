import { Injectable, Logger, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { NotificationService } from '../notification/notification.service';
import { renderTemplate, buildWeeklySummaryText, buildSummaryText, renderLowStreakInsight } from '../notification/notification.templates';

function tzOffsetAt(tz: string, date = new Date()): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return Math.round((local.getTime() - utc.getTime()) / 3_600_000);
}

function localDateString(tz: string, base = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(base);
}

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
    // Delay 30s: give CNPG time to come up after a container restart, and let
    // the bot finish connecting.  Use warn (not error) so a transient DB blip
    // at deploy time doesn't page the admin — the cron retries at midnight.
    setTimeout(() => {
      this.scheduleDailyReminders().catch((e) =>
        this.logger.warn(`Startup reminder catch-up failed (non-critical, retries at midnight): ${(e as Error).message}`),
      );
    }, 30_000);
  }

  /** Reschedule reminder for a single user (called after settings change). */
  async rescheduleForUser(userId: bigint) {
    const s = await this.botService.getUserSettings(userId);
    if (!s?.notifyEnabled) {
      await this.notificationService.cancel(userId, 'reminder');
      return;
    }
    await this.scheduleReminder(userId, s.notifyLocalHour, s.notifyTimezone, s.notifyReminderEnabled);
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
    // Kill-switch: release lock if runProcessQueue hangs past the next cron tick.
    const killTimer = setTimeout(() => {
      this.logger.error('processQueue timed out after 4 min — releasing lock');
      this.isProcessing = false;
    }, 4 * 60_000);
    try {
      await this.runProcessQueue();
    } catch (err: any) {
      // P1017 "Server has closed the connection" and other transient connection
      // errors should not page the admin on every cron tick — they resolve on
      // the next tick once the DB comes back.  Log as warn so AlertLogger
      // doesn't send a DM.
      const msg = String(err?.message ?? err);
      const isConnError = /server has closed the connection|connection.*refused|ECONNREFUSED|connect ETIMEDOUT|P1001|P1017/i.test(msg);
      if (isConnError) {
        this.logger.warn(`processQueue DB connection error (will retry): ${msg.slice(0, 120)}`);
      } else {
        this.logger.error(`processQueue failed: ${msg}`, err?.stack);
      }
    } finally {
      clearTimeout(killTimer);
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
        let template: ReturnType<typeof renderTemplate>;
        try {
          template = renderTemplate(notif.type as any, payload ?? undefined);
        } catch (renderErr) {
          this.logger.error(`renderTemplate threw for type=${notif.type} id=${notif.id} — skipping`, renderErr);
          await this.notificationService.markSent(notif.id);
          continue;
        }
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
        await Promise.race([
          this.bot!.telegram.sendMessage(notif.userId, template.text, opts),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('sendMessage timeout')), 15_000),
          ),
        ]);
        await this.notificationService.markSent(notif.id);
      } catch (err: any) {
        const code = err?.response?.error_code;
        const desc = String(err?.response?.description ?? err?.message ?? '');
        // Treat as permanently blocked only on explicit signals.
        // 400 + "chat not found" / 403 + "blocked"/"deactivated" / "kicked".
        // Other 400s (markdown parse error, message too long, etc) are bugs
        // on OUR side — don't mark legitimate users as blocked for those.
        const isPermanent =
          code === 403
          || (code === 400 && /chat not found|user is deactivated|bot was blocked/i.test(desc));
        if (isPermanent) {
          this.logger.warn(`Skipping notification id=${notif.id} userId=${notif.userId} (${code}: ${desc})`);
          await this.notificationService.markSent(notif.id);
          await this.botService.markUserBlocked(BigInt(notif.userId));
        } else {
          // Transient — log + don't markSent so we retry next tick.
          this.logger.error(`Failed to send notification id=${notif.id} userId=${notif.userId} (${code}: ${desc})`, err);
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
        const uid = BigInt(user.id);
        await this.scheduleReminder(uid, user.notifyLocalHour, user.notifyTimezone, user.notifyReminderEnabled);
        const isLapsing = await this.checkLapsingState(uid, user.notifyLocalHour, user.notifyTimezone);
        if (!isLapsing) {
          await this.checkMissedPlans(uid, user.notifyLocalHour, user.notifyTimezone);
          await this.scheduleLowStreakInsight(uid, user.notifyLocalHour, user.notifyTimezone);
        }
      } catch (err) {
        this.logger.error(`Midnight scheduler failed for userId=${user.id}`, err);
      }
    }
  }

  private async scheduleReminder(userId: bigint, notifyLocalHour: number, notifyTimezone: string, enabled = true) {
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
    const lowestNeedId = lowest?.needId;
    const lowestNeed = lowest ? this.botService.getNeeds().find(n => n.id === lowest.needId)?.chartLabel : undefined;
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const variant = Number((userId + BigInt(dayIndex)) % 5n);
    const seed = Number((userId + BigInt(dayIndex)) % 3n);
    const payload = { streak, yesterdayAvg, lowestNeedId, lowestNeed, variant, seed };

    const sendAt = this.nextSendAt(notifyLocalHour, notifyTimezone);

    // Always cancel stale reminders and reschedule fresh.
    // hasPending guard caused missed notifications: if a reminder survived from a
    // previous day (e.g. server was down at sendAt), the guard blocked scheduling
    // the next day's reminder entirely.
    await this.notificationService.cancel(userId, 'reminder');
    await this.notificationService.schedule(userId, 'reminder', sendAt, payload);

  }

  /** Returns true if a lapsing/dormant notification was scheduled (caller should skip other daily notifs) */
  private async checkLapsingState(userId: bigint, notifyLocalHour: number, notifyTimezone: string): Promise<boolean> {
    const days = await this.analyticsService.getDaysSinceLastFill(userId);
    const thresholds: Array<[number, 'lapsing_2' | 'lapsing_4' | 'dormant_7' | 'reengagement_30']> = [
      [2, 'lapsing_2'], [4, 'lapsing_4'], [7, 'dormant_7'], [30, 'reengagement_30'],
    ];
    for (const [d, type] of thresholds) {
      if (days === d) {
        const has = await this.notificationService.hasPending(userId, type);
        if (!has) {
          await this.notificationService.cancel(userId, 'reminder');
          await this.notificationService.schedule(userId, type, this.nextSendAt(notifyLocalHour, notifyTimezone));
        }
        return true;
      }
    }
    // Nudge every 30 days after day 30 (day 60, 90, 120...)
    if (days > 30 && days % 30 === 0) {
      const has = await this.notificationService.hasPending(userId, 'nudge');
      if (!has) {
        await this.notificationService.cancel(userId, 'reminder');
        await this.notificationService.schedule(userId, 'nudge', this.nextSendAt(notifyLocalHour, notifyTimezone), { daysSince: days });
      }
      return true;
    }
    return false;
  }

  private async checkMissedPlans(userId: bigint, notifyLocalHour: number, tz: string) {
    const yesterday = localDateString(tz, new Date(Date.now() - 86_400_000));
    const missed = await this.botService.getMissedPlans(userId, yesterday);
    if (missed.length > 0 && !await this.notificationService.hasPending(userId, 'practice_missed')) {
      const text = missed.map(p => p.practiceText).join(', ');
      await this.notificationService.schedule(userId, 'practice_missed', this.nextSendAt(notifyLocalHour, tz), { practiceText: text });
    }
  }

  async onDiaryComplete(userId: bigint) {
    await this.notificationService.cancel(userId, 'reminder');
    await this.notificationService.cancel(userId, 'pre_reminder');
    await this.notificationService.cancel(userId, 'low_streak_insight');

    const settings = await this.botService.getUserSettings(userId);
    const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
    const notifyLocalHour = settings?.notifyLocalHour ?? 21;
    const ratings = await this.botService.getRatings(userId);
    const text = buildSummaryText(this.botService.getNeeds(), ratings, tz);

    await this.notificationService.cancel(userId, 'summary');
    // Schedule summary after milestones: if notify hour passed, add 5 min so milestones (sent now)
    // arrive first and summary follows in the next processQueue cycle.
    const now = new Date();
    const todayStr = localDateString(tz, now);
    const noonRef = new Date(`${todayStr}T12:00:00.000Z`);
    const offset = tzOffsetAt(tz, noonRef);
    const todaySendAt = new Date(`${todayStr}T${String(notifyLocalHour).padStart(2, '0')}:00:00.000Z`);
    todaySendAt.setTime(todaySendAt.getTime() - offset * 3_600_000);
    const sendAt = todaySendAt > now ? todaySendAt : new Date(now.getTime() + 5 * 60_000);
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
        const uid = BigInt(user.id);
        if (await this.notificationService.hasPending(uid, 'weekly')) continue;
        // Skip dormant users — weekly summary is meaningless without recent data
        const daysSince = await this.analyticsService.getDaysSinceLastFill(uid);
        if (daysSince < 0 || daysSince >= 7) continue;
        const stats = await this.analyticsService.getWeeklyStats(uid);
        const bestDay = await this.analyticsService.getBestDayOfWeek(uid);
        const seed = user.id % 3;
        const text = buildWeeklySummaryText(stats, this.botService.getNeeds(), bestDay, seed);
        await this.notificationService.schedule(uid, 'weekly', this.nextSendAt(user.notifyLocalHour, user.notifyTimezone), { text });
      } catch (err) {
        this.logger.error(`Weekly summary failed for userId=${user.id}`, err);
      }
    }
  }

  /** Return sendAt for localHour in timezone, never in the past. DST-aware. */
  private nextSendAt(localHour: number, tz: string): Date {
    const now = new Date();
    for (let daysAhead = 0; daysAhead <= 1; daysAhead++) {
      const probe = new Date(now.getTime() + daysAhead * 86_400_000);
      const dateStr = localDateString(tz, probe);
      // Use noon as DST-safe reference to get the offset for that date
      const noonRef = new Date(`${dateStr}T12:00:00.000Z`);
      const offset = tzOffsetAt(tz, noonRef);
      const candidate = new Date(`${dateStr}T${String(localHour).padStart(2, '0')}:00:00.000Z`);
      candidate.setTime(candidate.getTime() - offset * 3_600_000);
      if (candidate > now) return candidate;
    }
    const probe2 = new Date(now.getTime() + 2 * 86_400_000);
    const dateStr2 = localDateString(tz, probe2);
    const noonRef2 = new Date(`${dateStr2}T12:00:00.000Z`);
    const offset2 = tzOffsetAt(tz, noonRef2);
    const result = new Date(`${dateStr2}T${String(localHour).padStart(2, '0')}:00:00.000Z`);
    result.setTime(result.getTime() - offset2 * 3_600_000);
    return result;
  }

  private async scheduleLowStreakInsight(userId: bigint, notifyLocalHour: number, notifyTimezone: string) {
    // Check for needs low 3+ days (threshold 5) and 10+ days (threshold 5) separately
    const [lowNeeds3, lowNeeds10] = await Promise.all([
      this.analyticsService.getLowStreakNeeds(userId, 5, 3),
      this.analyticsService.getLowStreakNeeds(userId, 5, 10),
    ]);
    const lowNeeds = lowNeeds10.length > 0 ? lowNeeds10 : lowNeeds3;
    if (lowNeeds.length === 0) return;
    if (await this.notificationService.hasPending(userId, 'low_streak_insight')) return;

    const needs = this.botService.getNeeds();
    const showBooking = lowNeeds10.length > 0;
    const daysBelowThreshold = showBooking ? 10 : 3;
    // Pick the single most concerning need (lowest avg, first in list)
    const need = needs.find((n) => n.id === lowNeeds[0])!;
    const { text } = renderLowStreakInsight(need.emoji, need.chartLabel, daysBelowThreshold);

    await this.notificationService.schedule(
      userId, 'low_streak_insight',
      this.nextSendAt(notifyLocalHour, notifyTimezone),
      { text, showBooking },
    );
  }
}
