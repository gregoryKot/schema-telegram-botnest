// Экраны /stats с кнопками: главные цифры и раздел. Полный отчёт
// (`/stats all`) — stats-messages.ts.
import { settleBlocks } from '../bot/stats-settle';
import { formatPoolStatus } from '../bot/healthy-adult.pool-alert';
import { infraBlocks } from '../bot/stats-infra-blocks';
import { POOL_BLOCK_NAME } from '../bot/stats-sections';
import type { BotAdminStatsService } from '../bot/bot.admin-stats.service';
import type { StatsReportService } from '../bot/stats-report.service';
import type { HealthyAdultService } from '../bot/healthy-adult.service';

export interface StatsDeps {
  adminStats: BotAdminStatsService;
  statsReport: StatsReportService;
  healthyAdult: HealthyAdultService;
}
export type WarnLogger = { warn(msg: string): void };

export const coreBlock = (d: StatsDeps) => ({
  name: 'Главные цифры',
  run: () => d.adminStats.getAdminStats(),
});

/** Блок «Запас фраз канала» (общий для полного отчёта и раздела «system»). */
export const poolBlock = (d: StatsDeps) => ({
  name: POOL_BLOCK_NAME,
  run: async () => formatPoolStatus(await d.healthyAdult.poolStatus()),
});

/** Главный экран `/stats`: главные цифры (под клавиатурой разделов). */
export async function collectMainStats(
  deps: StatsDeps,
  logger: WarnLogger,
): Promise<string> {
  const [core] = await settleBlocks([coreBlock(deps)], logger);
  return core;
}

/** Текст раздела. «system» дополняется блоками о здоровье самой системы и
 * запасом фраз канала: им нужны сервисы, которых в StatsReportService нет. */
export async function collectStatsSection(
  id: string,
  deps: StatsDeps,
  logger: WarnLogger,
): Promise<string> {
  if (id !== 'system') return deps.statsReport.renderSection(id);
  const parts = await settleBlocks(
    [
      {
        name: 'Поломки и напоминания',
        run: () => deps.statsReport.renderSection(id),
      },
      ...infraBlocks(),
      poolBlock(deps),
    ],
    logger,
  );
  return parts.join('\n\n');
}
