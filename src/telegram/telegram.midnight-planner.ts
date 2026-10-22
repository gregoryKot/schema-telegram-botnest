import type { Logger } from '@nestjs/common';
import type { AccountService } from '../bot/account.service';
import type { NotificationPlannerService } from '../notification/notification.planner.service';
import {
  LEASE_WINDOW,
  type CronLeaderService,
} from '../infra/cron-leader.service';

// Полуночный обход пользователей. Крон с арендой — в
// TelegramScheduleService.scheduleDailyReminders; обход вынесен сюда, потому
// что сервис на потолке размера (правило №10).
//
// Аренда `midnightPlanner` берётся на 23 часа ДО цикла. Деплой посреди обхода
// обрывал хвост, а catch-up нового процесса упирался в свежую аренду — хвост
// оставался без напоминаний до следующей полуночи (аудит 2026-10). Теперь:
// - прогон, дошедший до конца, отмечается `finishRun` (src/infra/cron-run-done.ts);
// - старт процесса видит незавершённый прогон и доделывает его с тем же
//   `runAt`: тот же локальный день и то же время отправки, что у оборванного;
// - повтор для уже обойдённого человека дублей не даёт — день забирается
//   атомарно в planDay (claimPlanDay, notification.cadence-store.ts);
// - проба cronLeases краснеет, если прогон не доделал никто (cron-lease-done.ts).
export class MidnightPlanner {
  private stopping = false;

  constructor(
    private readonly accounts: Pick<AccountService, 'getAllUsersWithSettings'>,
    private readonly planner: Pick<NotificationPlannerService, 'planDay'>,
    private readonly leases: Pick<
      CronLeaderService,
      'finishRun' | 'unfinishedRun'
    >,
    private readonly logger: Pick<Logger, 'log' | 'warn' | 'error'>,
  ) {}

  /** Процесс останавливается (onModuleDestroy): пул БД вот-вот закроется. */
  stop(): void {
    this.stopping = true;
  }

  /** Обход всех пользователей для прогона, захваченного в `runAt`. */
  async run(runAt: Date): Promise<void> {
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
    await this.leases.finishRun('midnightPlanner', runAt);
    this.logger.log(
      `Midnight planner: обработано ${users.length} из ${users.length}, ошибок ${failed}`,
    );
  }

  /**
   * Старт процесса: доделать оборванный прогон, а если доделывать нечего —
   * `claimAndRun` (полночь пропущена, пока процесса не было). Только при
   * старте, не на тике: иначе второй инстанс в 00:00 обходил бы параллельно
   * лидеру. Сбой — warn: следующая попытка — полночь, админа не будим.
   */
  async catchUp(claimAndRun: () => Promise<void>): Promise<void> {
    try {
      const runAt = await this.leases.unfinishedRun(
        'midnightPlanner',
        LEASE_WINDOW.daily,
      );
      if (!runAt) return await claimAndRun();
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
}
