import {
  Injectable,
  Logger,
  Inject,
  Optional,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService, NEED_IDS } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { AccountService } from '../bot/account.service';
import { PairsService } from '../bot/pairs.service';
import {
  NotificationService,
  QUIET_EXEMPT_TYPES,
} from '../notification/notification.service';
import { NotificationCadenceService } from '../notification/notification.cadence.service';
import { NotificationPlannerService } from '../notification/notification.planner.service';
import {
  renderTemplate,
  buildSummaryText,
} from '../notification/notification.templates';
import {
  isQuietHours,
  localDateString,
  nextQuietEnd,
  utcInstantForLocalHour,
} from '../notification/notification.time';
import { normalizeAddressForm } from '../notification/address-form';

@Injectable()
export class TelegramScheduleService implements OnModuleInit {
  private readonly logger = new Logger(TelegramScheduleService.name);

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly accountService: AccountService,
    private readonly pairsService: PairsService,
    private readonly notificationService: NotificationService,
    private readonly cadenceService: NotificationCadenceService,
    private readonly plannerService: NotificationPlannerService,
  ) {}

  private isProcessing = false;

  async onModuleInit() {
    // Catch-up: if midnight cron was missed (deploy/restart), run the planner.
    // Delay 30s: give CNPG time to come up after a container restart, and let
    // the bot finish connecting.  Use warn (not error) so a transient DB blip
    // at deploy time doesn't page the admin — the cron retries at midnight.
    // planDay is idempotent per local day (cadence notifyLastEvalDate + hasPending guards).
    setTimeout(() => {
      this.scheduleDailyReminders().catch((e) =>
        this.logger.warn(
          `Startup planner catch-up failed (non-critical, retries at midnight): ${(e as Error).message}`,
        ),
      );
    }, 30_000);
  }

  /** Reschedule reminder for a single user (called after settings change). */
  async rescheduleForUser(userId: bigint) {
    const s = await this.botService.getUserSettings(userId);
    if (!s?.notifyEnabled || !s.notifyReminderEnabled) {
      await this.notificationService.cancel(userId, 'reminder');
      return;
    }
    // На паузе ничего не планируем — юзер попросил тишины
    if (s.notifyPausedUntil && s.notifyPausedUntil > new Date()) return;
    const hadPending = await this.notificationService.hasPending(
      userId,
      'reminder',
    );
    // due покрывает включение уведомлений после перерыва: nextRemindDate устарел или пуст
    const today = localDateString(s.notifyTimezone, new Date());
    const due = !s.notifyNextRemindDate || today >= s.notifyNextRemindDate;
    if (hadPending || due) {
      await this.plannerService.scheduleReminder(
        userId,
        s.notifyLocalHour,
        s.notifyTimezone,
        new Date(),
        !!s.notifyGamified,
      );
    }
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
      const isConnError =
        /server has closed the connection|connection.*refused|ECONNREFUSED|connect ETIMEDOUT|P1001|P1017/i.test(
          msg,
        );
      if (isConnError) {
        this.logger.warn(
          `processQueue DB connection error (will retry): ${msg.slice(0, 120)}`,
        );
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

    const sendSettings = await this.accountService.getSendSettingsFor(
      [...new Set(due.map((n) => n.userId))].map((id) => BigInt(id)),
    );

    for (const notif of due) {
      try {
        const s = sendSettings.get(String(notif.userId));
        // Тихие часы: проактивные придерживаем до утра. Покрывает и catch-up после
        // даунтайма — уведомление за 21:00 не улетит в 3 ночи.
        if (!QUIET_EXEMPT_TYPES.includes(notif.type as any)) {
          if (s && isQuietHours(s.tz, s.start, s.end)) {
            await this.notificationService.defer(
              notif.id,
              nextQuietEnd(s.tz, s.end),
            );
            continue;
          }
        }
        const payload = notif.payload as Record<string, unknown> | null;
        let template: ReturnType<typeof renderTemplate>;
        try {
          template = renderTemplate(
            notif.type as any,
            payload ?? undefined,
            normalizeAddressForm(s?.form),
          );
        } catch (renderErr) {
          this.logger.error(
            `renderTemplate threw for type=${notif.type} id=${notif.id} — skipping`,
            renderErr,
          );
          await this.notificationService.markSent(notif.id);
          continue;
        }
        if (!template) {
          this.logger.warn(
            `No template for type=${notif.type} id=${notif.id} — skipping`,
          );
          await this.notificationService.markSent(notif.id);
          continue;
        }
        const silent = notif.type === 'summary';
        const opts = {
          ...(template.keyboard
            ? { reply_markup: template.keyboard.reply_markup }
            : {}),
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
          code === 403 ||
          (code === 400 &&
            /chat not found|user is deactivated|bot was blocked/i.test(desc));
        if (isPermanent) {
          this.logger.warn(
            `Skipping notification id=${notif.id} userId=${notif.userId} (${code}: ${desc})`,
          );
          await this.notificationService.markSent(notif.id);
          await this.accountService.markUserBlocked(BigInt(notif.userId));
        } else {
          // Transient — log + don't markSent so we retry next tick.
          this.logger.error(
            `Failed to send notification id=${notif.id} userId=${notif.userId} (${code}: ${desc})`,
            err,
          );
        }
      }
    }
  }

  /**
   * Midnight UTC: единый дневной планировщик. Вся логика приоритетов (пауза,
   * перерывы, weekly, donate, напоминание, инсайты) — в NotificationPlannerService,
   * который гарантирует максимум одно проактивное уведомление в день.
   */
  @Cron('0 0 * * *')
  async scheduleDailyReminders() {
    if (!this.bot) return;
    const users = await this.accountService.getAllUsersWithSettings();
    this.logger.log(`Midnight planner: ${users.length} users`);

    for (const user of users) {
      try {
        await this.plannerService.planDay(user);
      } catch (err) {
        this.logger.error(`Midnight planner failed for userId=${user.id}`, err);
      }
    }
  }

  async onDiaryComplete(userId: bigint) {
    await this.notificationService.cancel(userId, 'reminder');
    await this.notificationService.cancel(userId, 'pre_reminder');
    await this.notificationService.cancel(userId, 'low_streak_insight');
    await this.cadenceService.registerFill(userId);

    const settings = await this.botService.getUserSettings(userId);
    const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
    const notifyLocalHour = settings?.notifyLocalHour ?? 21;
    const ratings = await this.botService.getRatings(userId);
    const text = buildSummaryText(
      this.botService.getNeeds(),
      ratings,
      tz,
      normalizeAddressForm(settings?.addressForm),
    );

    await this.notificationService.cancel(userId, 'summary');
    // Schedule summary after milestones: if notify hour passed, add 5 min so milestones (sent now)
    // arrive first and summary follows in the next processQueue cycle.
    const now = new Date();
    const todayStr = localDateString(tz, now);
    const todaySendAt = utcInstantForLocalHour(todayStr, notifyLocalHour, tz);
    const sendAt =
      todaySendAt > now ? todaySendAt : new Date(now.getTime() + 5 * 60_000);
    await this.notificationService.schedule(userId, 'summary', sendAt, {
      text,
    });

    // 4.5 (аудит 2026-07): лёгкий социальный триггер для напарника — до
    // раннего return'а comeback-ветки, чтобы срабатывал в обоих путях.
    await this.maybeNotifyPairPartners(userId).catch((err) =>
      this.logger.error('maybeNotifyPairPartners failed', err),
    );

    const total = await this.analyticsService.getTotalDaysFilled(userId);

    // Возвращение после перерыва ≥3 дней: тёплое «с возвращением» вместо вех —
    // одно празднование в день, без упоминания длины перерыва и сгоревших серий.
    const gap = await this.analyticsService.getGapBeforeLatestFill(userId);
    if (gap !== null && gap >= 3) {
      const last = await this.notificationService.lastSentAt(
        userId,
        'comeback',
      );
      const sentToday = last !== null && localDateString(tz, last) === todayStr;
      if (
        !sentToday &&
        !(await this.notificationService.hasPending(userId, 'comeback'))
      ) {
        // Value-based возврат: добавляем зеркало собственных данных (сильнейшая потребность).
        const insight = await this.analyticsService.getProfileInsight(userId);
        const strongestNeed = insight
          ? this.botService.getNeeds().find((n) => n.id === insight.strongest)
              ?.chartLabel
          : undefined;
        await this.notificationService.schedule(
          userId,
          'comeback',
          new Date(),
          {
            totalDays: total,
            strongestNeed,
            strongestAvg: insight?.strongestAvg,
          },
        );
      }
      return;
    }

    const streak = await this.analyticsService.getConsecutiveDays(userId);
    for (const days of [7, 14, 30] as const) {
      if (
        streak === days &&
        !(await this.notificationService.hasEver(userId, `streak_${days}`))
      ) {
        await this.notificationService.schedule(
          userId,
          `streak_${days}`,
          new Date(),
        );
      }
    }

    for (const days of [1, 3, 7] as const) {
      if (
        total === days &&
        !(await this.notificationService.hasEver(userId, `onboarding_${days}`))
      ) {
        await this.notificationService.schedule(
          userId,
          `onboarding_${days}`,
          new Date(),
        );
      }
    }
    for (const days of [30, 60, 90] as const) {
      if (
        total === days &&
        !(await this.notificationService.hasEver(userId, `anniversary_${days}`))
      ) {
        await this.notificationService.schedule(
          userId,
          `anniversary_${days}`,
          new Date(),
        );
      }
    }
  }

  /**
   * Парный триггер (аудит 2026-07, этап 4.5): юзер заполнил трекер —
   * мягко подсказать активным напарникам, без сравнения и соревнования.
   * Ограничители: уведомления напарника включены; напарник сегодня ещё
   * не заполнил сам; максимум одно pair_activity в день (по его таймзоне);
   * тихие часы уважает очередь (тип не quiet-exempt), дневной бюджет —
   * PROACTIVE_TYPES.
   */
  async maybeNotifyPairPartners(userId: bigint): Promise<void> {
    const pairs = await this.pairsService.getUserPairs(userId);
    for (const pair of pairs) {
      if (pair.status !== 'active' || pair.partnerId === null) continue;
      const partnerId = BigInt(pair.partnerId);

      const settings = await this.botService.getUserSettings(partnerId);
      if (!settings || settings.notifyEnabled === false) continue;

      // Напарник уже заполнил сегодня сам — подсказка не нужна.
      const partnerRatings = await this.botService.getRatings(partnerId);
      if (NEED_IDS.every((id) => partnerRatings[id] !== undefined)) continue;

      const tz = settings.notifyTimezone ?? 'Europe/Moscow';
      const todayStr = localDateString(tz, new Date());
      const last = await this.notificationService.lastSentAt(
        partnerId,
        'pair_activity',
      );
      const sentToday = last !== null && localDateString(tz, last) === todayStr;
      if (
        sentToday ||
        (await this.notificationService.hasPending(partnerId, 'pair_activity'))
      ) {
        continue;
      }

      await this.notificationService.schedule(
        partnerId,
        'pair_activity',
        new Date(),
      );
    }
  }
}
