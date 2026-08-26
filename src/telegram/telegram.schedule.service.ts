import {
  Injectable,
  Logger,
  Inject,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { CatchupTimer } from './telegram.catchup-timer';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { AccountService } from '../bot/account.service';
import { PairsService } from '../bot/pairs.service';
import {
  NotificationService,
  QUIET_EXEMPT_TYPES,
  NotificationType,
} from '../notification/notification.service';
import { NotificationCadenceService } from '../notification/notification.cadence.service';
import { NotificationPlannerService } from '../notification/notification.planner.service';
import { renderTemplate } from '../notification/notification.templates';
import {
  isQuietHours,
  localDateString,
  nextQuietEnd,
} from '../notification/notification.time';
import { normalizeAddressForm } from '../notification/address-form';
import {
  runDiaryComplete,
  maybeNotifyPairPartners,
  type DiaryCompleteDeps,
} from './telegram.diary-complete';

@Injectable()
export class TelegramScheduleService implements OnModuleInit, OnModuleDestroy {
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
  private readonly catchupTimer = new CatchupTimer();

  onModuleInit() {
    // Catch-up: планировщик пропустил полночь (деплой/рестарт) — досчитать
    // через 30с (прогрев CNPG/бота). planDay идемпотентен, warn не будит админа.
    this.catchupTimer.arm(() => {
      this.scheduleDailyReminders().catch((e) =>
        this.logger.warn(
          `Startup planner catch-up failed (non-critical, retries at midnight): ${(e as Error).message}`,
        ),
      );
    }, 30_000);
  }

  // Иначе таймер стреляет в закрытый Prisma-пул после app.close() — см.
  // комментарий в telegram.catchup-timer.ts.
  onModuleDestroy() {
    this.catchupTimer.clear();
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
    } catch (err: unknown) {
      // P1017 "Server has closed the connection" and other transient connection
      // errors should not page the admin on every cron tick — they resolve on
      // the next tick once the DB comes back.  Log as warn so AlertLogger
      // doesn't send a DM.
      const e = err instanceof Error ? err : undefined;
      const msg = e?.message ?? String(err);
      const isConnError =
        /server has closed the connection|connection.*refused|ECONNREFUSED|connect ETIMEDOUT|P1001|P1017/i.test(
          msg,
        );
      if (isConnError) {
        this.logger.warn(
          `processQueue DB connection error (will retry): ${msg.slice(0, 120)}`,
        );
      } else {
        this.logger.error(`processQueue failed: ${msg}`, e?.stack);
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
        if (!QUIET_EXEMPT_TYPES.includes(notif.type as NotificationType)) {
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
            notif.type as NotificationType,
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
      } catch (err: unknown) {
        const e = err as {
          response?: { error_code?: number; description?: string };
          message?: string;
        };
        const code = e.response?.error_code;
        const desc = String(e.response?.description ?? e.message ?? '');
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

  // Midnight UTC: единый дневной планировщик — приоритеты (пауза, перерывы,
  // weekly/donate/напоминание/инсайты) в NotificationPlannerService, максимум одно уведомление в день.
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

  /** Трекер заполнен: сводка, вехи, напарник — см. telegram.diary-complete.ts. */
  async onDiaryComplete(userId: bigint) {
    return runDiaryComplete(this.diaryDeps(), userId);
  }

  async maybeNotifyPairPartners(userId: bigint): Promise<void> {
    return maybeNotifyPairPartners(this.diaryDeps(), userId);
  }

  private diaryDeps(): DiaryCompleteDeps {
    return {
      botService: this.botService,
      analyticsService: this.analyticsService,
      pairsService: this.pairsService,
      notificationService: this.notificationService,
      cadenceService: this.cadenceService,
      logger: this.logger,
    };
  }
}
