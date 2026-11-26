// Реестр env (env-registry.ts), группа infra: площадка, сайт, супервизор, веб-пуши; → INFRA_ENV_ENTRIES.
import { EnvVarSpec, formats } from './env-registry';
import { SUPERVISOR_ENV_ENTRIES } from './env-registry.entries.supervisor';
import { PUSH_ENV_ENTRIES } from './env-registry.entries.push';

export const PLATFORM_ENV_ENTRIES: EnvVarSpec[] = [
  ...SUPERVISOR_ENV_ENTRIES,
  ...PUSH_ENV_ENTRIES,
  {
    name: 'SITE_URL',
    purpose:
      'Адрес сайта для ссылок в уведомлениях о записи — дефолт kotlarewski.gr.',
    requiredInProd: false,
    format: formats.url,
    group: 'infra',
  },
];
