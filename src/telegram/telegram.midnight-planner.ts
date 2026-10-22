import type { Logger } from '@nestjs/common';
import type { AccountService } from '../bot/account.service';
import type { NotificationPlannerService } from '../notification/notification.planner.service';
import type { CronLeaderService } from '../infra/cron-leader.service';

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

/**
 * Сколько после начала оборванного прогона его ещё доделывать. Доделка идёт с
 * `now = runAt`, и время отправки, которое к старту уже прошло, очередь
 * отправляет на ближайшем тике. Доделка через 20 часов дала бы человеку
 * «сегодняшнее» напоминание за пару часов до завтрашнего — поэтому окно 6 ч,
 * а не всё окно аренды (23 ч). Позже доделки нет: остаток — до полуночи, и его
 * видит проба cronLeases (2 ч, cron-lease-done.ts).
 */
export const RESUME_WINDOW_MS = 6 * 3_600_000;

export class MidnightPlanner {
  private stopping = false;
  /** Обход уже идёт в этом процессе (тик в 00:00 или доделка). */
  private running = false;

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
   * `claimAndRun` (полночь пропущена, пока процесса не было). Только при
   * старте, не на тике: иначе второй инстанс в 00:00 обходил бы параллельно
   * лидеру. Сбой — warn: следующая попытка — полночь, админа не будим.
   * Обход уже идёт в этом процессе (старт в 23:59, тик в 00:00 успел раньше) —
   * второй параллельный не нужен: дублей не дал бы захват дня, но нагрузка
   * удвоилась бы.
   */
  async catchUp(claimAndRun: () => Promise<void>): Promise<void> {
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
