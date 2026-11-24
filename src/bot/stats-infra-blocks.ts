import { formatCapabilityReport } from './capability-metrics.format';
import { buildCapabilityReport } from '../infra/capability-report';
import { formatEnvCheckReport } from './env-check.format';
import { checkEnv } from '../infra/env-check';
import { renderCalendarHealthBlock } from '../booking/caldav-health';
import { selfCheckBlock } from '../infra/self-check/unrecorded-green';
import { selfCheckState } from '../infra/self-check/state';
import { formatLegacyPlanSource } from './plan-metrics.format';
import type { SettleBlock } from './stats-settle';

export interface LegacySourceCounter {
  legacySourceCount(): Promise<number>;
}

/** Строка про старые колонки плана; сбой счёта не гасит остальную самопроверку. */
async function legacySourceLine(plan?: LegacySourceCounter): Promise<string> {
  if (!plan) return '';
  try {
    return `\n${formatLegacyPlanSource(await plan.legacySourceCount())}`;
  } catch {
    return '\nПункты плана со старой записью источника: посчитать не удалось';
  }
}

/** Хвост второго сообщения /stats: блоки о здоровье самой системы. Порядок
 * важен (календарь → настройки → переменные → самопроверка), каждый
 * считается независимо — падение одного не прячет остальные. */
export function infraBlocks(plan?: LegacySourceCounter): SettleBlock[] {
  return [
    { name: 'Календари', run: () => renderCalendarHealthBlock() },
    {
      name: 'Настройки',
      run: () => formatCapabilityReport(buildCapabilityReport()),
    },
    { name: 'Переменные', run: () => formatEnvCheckReport(checkEnv()) },
    {
      name: 'Самопроверка',
      run: async () =>
        selfCheckBlock(selfCheckState.get()) + (await legacySourceLine(plan)),
    },
  ];
}
