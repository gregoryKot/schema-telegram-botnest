import { settleBlocks } from '../bot/stats-settle';
import { coreBlock, poolBlock, type StatsDeps } from './stats-screens';

/** Два сообщения `/stats all`. Каждая часть считается отдельно: упавшая
 * заменяется строкой-заглушкой, остальные доезжают (settleBlocks). */
export async function collectStatsMessages(
  deps: StatsDeps,
  logger: { warn(msg: string): void },
): Promise<{ first: string; second: string }> {
  const [core, product, pool] = await settleBlocks(
    [
      coreBlock(deps),
      { name: 'Остальной отчёт', run: () => deps.statsReport.render() },
      poolBlock(deps),
    ],
    logger,
  );
  return { first: core, second: `${product}\n\n${pool}` };
}
