import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CronLeaderService, LEASE_WINDOW } from '../cron-leader.service';
import { CatchupTimer } from '../../telegram/telegram.catchup-timer';
import { notifyAdminWithFallback } from '../../utils/admin-alert';
import { buildProbes } from './registry';
import { runProbes } from './runner';
import { selfCheckState, SelfCheckResultEntry } from './state';
import { selfCheckAlerts } from './alert-tracker';

/** ~60с после старта — приложение успело поднять слушатель, но ещё не успело
 * закрасться в тишину до первого реального трафика (инциденты 2026-09-13/16
 * жили именно в этой тишине — правило №14 CLAUDE.md). */
const POST_DEPLOY_DELAY_MS = 60_000;

@Injectable()
export class SelfCheckService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SelfCheckService.name);
  private readonly bootTimer = new CatchupTimer();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  onApplicationBootstrap(): void {
    this.bootTimer.arm(
      () => void this.run('post-deploy'),
      POST_DEPLOY_DELAY_MS,
    );
  }

  // Снять таймер на закрытии — ровно то, для чего CatchupTimer и сделан:
  // неснятый, он стреляет в закрытый Prisma-пул и роняет e2e-шаг целиком
  // (pg → net.Socket после teardown), стоит сьюту прожить дольше 60с.
  onModuleDestroy(): void {
    this.bootTimer.clear();
  }

  // Без аренды второй инстанс (масштабирование/деплой) тикает тем же часом и
  // шлёт дубль DM при сбое — leader-election (правило №17 CLAUDE.md,
  // scripts/cron-leader-baseline.json).
  @Cron('43 * * * *', { name: 'selfCheckHourly' })
  async hourly(): Promise<void> {
    if (
      !(await this.cronLeader.claimRun('selfCheckHourly', LEASE_WINDOW.hourly))
    )
      return;
    await this.run('hourly');
  }

  /** Прогоняет все пробы, обновляет снимок для /health и /stats, шлёт DM по
   * смене состояния. Публичный — тесты и оба триггера зовут его напрямую. */
  async run(trigger: string): Promise<SelfCheckResultEntry[]> {
    const results = await runProbes(buildProbes(this.prisma));
    selfCheckState.set(results);
    const failed = results.filter((r) => !r.ok);
    if (failed.length === 0) {
      this.logger.log(`Самопроверка (${trigger}): всё в порядке.`);
    } else {
      this.logger.log(
        `Самопроверка (${trigger}): не в порядке — ${failed.map((f) => f.id).join(', ')}`,
      );
    }
    const text = selfCheckAlerts.noteResult(failed);
    if (text) void notifyAdminWithFallback(text, 'Самопроверка SchemeHappens');
    return results;
  }
}
