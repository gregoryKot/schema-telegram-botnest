import type { Logger } from '@nestjs/common';
import type { AccountService } from '../bot/account.service';
import type { NotificationPlannerService } from '../notification/notification.planner.service';
import type { CronLeaderService } from '../infra/cron-leader.service';
import {
  catchUpClaimWindowMs,
  RESUME_WINDOW_MS,
} from './telegram.midnight-lease';

// Полуночный обход пользователей. Крон с арендой — в
// TelegramScheduleService.scheduleDailyReminders (сервис на потолке размера).
// Аренда `midnightPlanner` берётся ДО цикла; деплой посреди обхода обрывал хвост
// до следующей полуночи (аудит 2026-10). Поэтому: прогон, дошедший до конца,
// отмечается `finishRun` (cron-run-done.ts); старт процесса доделывает
// незавершённый с тем же `runAt`; повтор дублей не даёт — день забирается
// атомарно (claimPlanDay); проба cronLeases краснеет, если не доделал никто.
// Окна доделки и захвата при старте — telegram.midnight-lease.ts.

export class MidnightPlanner {
  private stopping = false;
  /** Обход уже идёт в этом процессе (тик в 00:00 или доделка). */
  private running = false;

  constructor(
    private readonly accounts: Pick<AccountService, 'getAllUsersWithSettings'>,
    private readonly planner: Pick<NotificationPlannerService, 'planDay'>,
    private readonly leases: Pick<
      CronLeaderService,
      'claimRun' | 'finishRun' | 'unfinishedRun'
    >,
    private readonly logger: Pick<Logger, 'log' | 'warn' | 'error'>,
  ) {}

  /** Процесс останавливается (onModuleDestroy): пул БД вот-вот закроется. */
  stop(): void {
    this.stopping = true;
  }

  /** Обход всех пользователей для прогона, захваченного в `runAt`. */
  async run(runAt: Date): Promise<void> {
    this.running = true;
    try {
      await this.walk(runAt);
    } finally {
      this.running = false;
    }
  }

  private async walk(runAt: Date): Promise<void> {
    const users = await this.accounts.getAllUsersWithSettings();
    this.logger.log(`Midnight planner: ${users.length} users`);
    let failed = 0;
    for (const [i, user] of users.entries()) {
      // Дальше каждый planDay упал бы в закрытый пул с error на человека.
      // Выходим без отметки о завершении — остаток доделает следующий старт.
      if (this.stopping) {
        this.logger.warn(
          `Midnight planner прерван остановкой процесса: обработано ${i} из ${users.length}, остаток доделает следующий старт`,
        );
        return;
      }
      try {
        await this.planner.planDay(user, runAt);
      } catch (err) {
        failed += 1;
        this.logger.error(`Midnight planner failed for userId=${user.id}`, err);
      }
    }
    try {
      await this.leases.finishRun('midnightPlanner', runAt);
    } catch (e) {
      // Остановка пришла после последнего человека, и пул уже закрыт. Обход
      // пройден целиком; следующий старт пройдёт его ещё раз вхолостую — день
      // каждого уже забран (claimPlanDay), дублей нет.
      this.logger.warn(
        `Midnight planner: отметка завершения не записалась: ${(e as Error).message}`,
      );
    }
    this.logger.log(
      `Midnight planner: обработано ${users.length} из ${users.length}, ошибок ${failed}`,
    );
  }

  /**
   * Старт процесса: доделать оборванный прогон, а если доделывать нечего —
   * захватить пропущенную полночь (`catchUpClaimWindowMs`). Только при
   * старте, не на тике: иначе второй инстанс в 00:00 обходил бы параллельно
   * лидеру. Сбой — warn: следующая попытка — полночь, админа не будим.
   * Обход уже идёт в этом процессе (старт в 23:59, тик успел раньше) — второй
   * не нужен: дублей не дал бы захват дня, но нагрузка удвоилась бы.
   */
  async catchUp(at: Date = new Date()): Promise<void> {
    if (this.running) {
      this.logger.log(
        'Midnight planner: обход уже идёт, доделка при старте не нужна',
      );
      return;
    }
    try {
      const runAt = await this.leases.unfinishedRun(
        'midnightPlanner',
        RESUME_WINDOW_MS,
      );
      if (!runAt) return await this.claimMissed(at);
      this.logger.log(
        `Midnight planner: доделываю обход от ${runAt.toISOString()}`,
      );
      await this.run(runAt);
    } catch (e) {
      this.logger.warn(
        `Startup planner catch-up failed (non-critical, retries at midnight): ${(e as Error).message}`,
      );
    }
  }

  /** null-окно — последний час до 00:00 UTC: обход сделает тик. */
  private async claimMissed(at: Date): Promise<void> {
    const windowMs = catchUpClaimWindowMs(at);
    if (
      windowMs !== null &&
      (await this.leases.claimRun('midnightPlanner', windowMs, at))
    )
      return this.run(at);
    this.logger.log('Midnight planner: при старте обход не нужен');
  }
}
