// Записи реестра env-переменных (см. env-registry.ts) — площадка и адрес
// сайта; подключаются в INFRA_ENV_ENTRIES. Отдельный файл: infra под
// храповиком размера (правило №10). Группа — infra.
import { EnvVarSpec, formats } from './env-registry';
import { DEPLOY_TARGETS } from './deploy-target';

export const PLATFORM_ENV_ENTRIES: EnvVarSpec[] = [
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
