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
import { NotificationService } from '../notification/notification.service';
import { NotificationCadenceService } from '../notification/notification.cadence.service';
import { NotificationPlannerService } from '../notification/notification.planner.service';
import { localDateString } from '../notification/notification.time';
import {
  runDiaryComplete,
  maybeNotifyPairPartners,
  type DiaryCompleteDeps,
} from './telegram.diary-complete';
import { runProcessQueue } from './telegram.schedule-queue';
import { isConnectionError } from '../logger/db-outage';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';

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
    private readonly cronLeader: CronLeaderService,
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
    // Флаг ставится ДО claimRun (а не после): claimRun асинхронный, и без
    // этого второй параллельный вызов processQueue() успел бы проскочить
    // проверку isProcessing выше, пока первый ещё ждёт ответ от БД — лок
    // ловил бы гонку с чужим инстансом, но не с самим собой.
    this.isProcessing = true;
    // Без аренды второй инстанс рассылает те же уведомления из очереди ещё
    // раз — пользователь получает напоминание дважды.
    if (
      !(await this.cronLeader.claimRun(
        'notificationQueue',
        LEASE_WINDOW.fiveMinutes,
      ))
    ) {
      this.logger.debug('processQueue: тик уже забрал другой инстанс');
      this.isProcessing = false;
      return;
    }
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
      // doesn't send a DM. Признаки — общие с AlertLogger (src/logger/db-outage.ts),
      // здесь берём мягкую проверку: важно не куда оборвалось соединение, а что
      // ошибка временная. Раньше guard искал "P1001" в ТЕКСТЕ сообщения, а
      // Prisma кладёт код в err.code — guard молчал (инцидент 2026-08-31).
      const e = err instanceof Error ? err : undefined;
      const msg = e?.message ?? String(err);
      if (isConnectionError(err)) {
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
    return runProcessQueue({
      bot: this.bot!,
      accountService: this.accountService,
      notificationService: this.notificationService,
      logger: this.logger,
    });
  }

  // Midnight UTC: единый дневной планировщик — приоритеты (пауза, перерывы,
  // weekly/donate/напоминание/инсайты) в NotificationPlannerService, максимум одно уведомление в день.
  @Cron('0 0 * * *')
  async scheduleDailyReminders() {
    if (!this.bot) return;
    // Без аренды второй инстанс планирует тот же день второй раз — пользователь
    // получает два одинаковых напоминания/инсайта за сутки.
    if (
      !(await this.cronLeader.claimRun('midnightPlanner', LEASE_WINDOW.daily))
    )
      return;
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
