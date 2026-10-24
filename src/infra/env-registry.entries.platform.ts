// Реестр env (env-registry.ts), группа infra: площадка, сайт, супервизор; → INFRA_ENV_ENTRIES.
import { EnvVarSpec, formats } from './env-registry';
import { DEPLOY_TARGETS } from './deploy-target';
import { SUPERVISOR_ENV_ENTRIES } from './env-registry.entries.supervisor';

export const PLATFORM_ENV_ENTRIES: EnvVarSpec[] = [
  ...SUPERVISOR_ENV_ENTRIES,
  {
    name: 'DEPLOY_TARGET',
    purpose:
      'Площадка: «vps» (задаёт deploy/vps/docker-compose.yml) — там pgdata ' +
      'единственная копия базы, и бэкапы в R2 обязательны; не задана или ' +
      '«amvera» — бэкапы платформы, R2 по желанию.',
    requiredInProd: false,
    format: formats.oneOf([...DEPLOY_TARGETS]),
    group: 'infra',
  },
  {
    name: 'SITE_URL',
    purpose:
      'Адрес сайта для ссылок в уведомлениях о записи — дефолт kotlarewski.gr.',
    requiredInProd: false,
    format: formats.url,
    group: 'infra',
  },
];
