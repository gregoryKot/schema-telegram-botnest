import { settleBlocks } from '../bot/stats-settle';
import { formatPoolStatus } from '../bot/healthy-adult.pool-alert';
import type { BotAdminStatsService } from '../bot/bot.admin-stats.service';
import type { StatsReportService } from '../bot/stats-report.service';
import type { HealthyAdultService } from '../bot/healthy-adult.service';

/** Два сообщения команды /stats. Каждая часть считается отдельно: упавшая
 * заменяется строкой-заглушкой, остальные доезжают (settleBlocks). */
export async function collectStatsMessages(
  deps: {
    adminStats: BotAdminStatsService;
    statsReport: StatsReportService;
    healthyAdult: HealthyAdultService;
  },
  logger: { warn(msg: string): void },
): Promise<{ first: string; second: string }> {
  const [core, product, pool] = await settleBlocks(
    [
      { name: 'Главные цифры', run: () => deps.adminStats.getAdminStats() },
      { name: 'Остальной отчёт', run: () => deps.statsReport.render() },
      {
        name: 'Запас фраз канала',
        run: async () => formatPoolStatus(await deps.healthyAdult.poolStatus()),
      },
    ],
    logger,
  );
  return { first: core, second: `${product}\n\n${pool}` };
}
