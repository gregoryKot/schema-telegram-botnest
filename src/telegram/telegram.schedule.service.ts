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
import { runProcessQueue, armQueueKillSwitch } from './telegram.schedule-queue';
import { MidnightPlanner } from './telegram.midnight-planner';
import { AnalyticsService } from '../analytics/analytics.service';
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
    @Optional() private readonly analytics?: AnalyticsService,
  ) {
    this.midnight = new MidnightPlanner(
      accountService,
      plannerService,
      cronLeader,
      this.logger,
    );
  }

  private isProcessing = false;
  private readonly midnight: MidnightPlanner;
  private readonly catchupTimer = new CatchupTimer();

  onModuleInit() {
    // Через 30с после старта (прогрев CNPG/бота): доделать оборванный обход
    // или пропущенную полночь — MidnightPlanner.catchUp.
    this.catchupTimer.arm(() => void this.catchUpAfterStart(), 30_000);
  }

  // Иначе таймер стреляет в закрытый Prisma-пул после app.close() — см.
  // комментарий в telegram.catchup-timer.ts. Идущий обход выходит сам.
  onModuleDestroy() {
    this.catchupTimer.clear();
    this.midnight.stop();
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
    const killTimer = armQueueKillSwitch(this.logger, () => {
      this.isProcessing = false;
    });
    try {
      await this.runProcessQueue();
    } catch (err: unknown) {
      // Обрыв соединения с БД (P1017 и соседи) проходит к следующему тику —
      // warn, чтобы AlertLogger не будил админа каждый тик. Признаки общие с
      // AlertLogger (src/logger/db-outage.ts), проверка мягкая: важно, что
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
      track: (t) => this.analytics?.track(null, 'notify_queue_tick', t),
    });
  }

  // Midnight UTC: единый дневной планировщик — приоритеты (пауза, перерывы,
  // weekly/donate/напоминание/инсайты) в NotificationPlannerService, одно в день; обход — MidnightPlanner.
  @Cron('0 0 * * *')
  async scheduleDailyReminders() {
    if (!this.bot) return;
    // Аренда: без неё второй инстанс спланирует тот же день повторно (дубли).
    // Окно — час, не сутки: см. заголовок telegram.midnight-planner.ts.
    const at = new Date();
    if (
      await this.cronLeader.claimRun('midnightPlanner', LEASE_WINDOW.hourly, at)
    )
      await this.midnight.run(at);
    else this.logger.log('Midnight planner: аренду уже взял другой прогон');
  }

  async catchUpAfterStart() {
    if (this.bot) await this.midnight.catchUp();
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
