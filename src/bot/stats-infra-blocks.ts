import { formatCapabilityReport } from './capability-metrics.format';
import { buildCapabilityReport } from '../infra/capability-report';
import { formatEnvCheckReport } from './env-check.format';
import { checkEnv } from '../infra/env-check';
import { renderCalendarHealthBlock } from '../booking/caldav-health';
import { formatSelfCheck } from '../infra/self-check/format';
import { selfCheckState } from '../infra/self-check/state';
import type { SettleBlock } from './stats-settle';

/** Хвост второго сообщения /stats: блоки о здоровье самой системы. Порядок
 * важен (календарь → настройки → переменные → самопроверка), каждый
 * считается независимо — падение одного не прячет остальные. */
export function infraBlocks(): SettleBlock[] {
  return [
    { name: 'Календари', run: () => renderCalendarHealthBlock() },
    {
      name: 'Настройки',
      run: () => formatCapabilityReport(buildCapabilityReport()),
    },
    { name: 'Переменные', run: () => formatEnvCheckReport(checkEnv()) },
    { name: 'Самопроверка', run: () => formatSelfCheck(selfCheckState.get()) },
  ];
}
