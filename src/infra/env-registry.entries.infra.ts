// Записи реестра env-переменных (см. env-registry.ts) — группа infra:
// БД, публичные адреса сайта/вебаппа, CORS, платные фичи-флаги.
import { EnvVarSpec, formats } from './env-registry';
import { PLATFORM_ENV_ENTRIES } from './env-registry.entries.platform';
import { isValidStatementTimeout } from '../prisma/statement-timeout';

export const INFRA_ENV_ENTRIES: EnvVarSpec[] = [
  ...PLATFORM_ENV_ENTRIES,
  {
    name: 'ALLOWED_ORIGINS',
    purpose:
      'CORS-список источников через запятую (нужен мини-аппу — другой origin) ' +
      '— без него используется дефолтный список из main.ts.',
    requiredInProd: false,
    format: formats.any,
    group: 'infra',
  },
  {
    name: 'APP_URL',
    purpose:
      'Базовый адрес для ссылок в письмах/боте (donate, subscribe) — дефолт ' +
      'schemehappens.ru; допускается голый домен без схемы (normalizeBaseUrl).',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'infra',
  },
  {
    name: 'DATABASE_URL',
    purpose:
      'Строка подключения к Postgres — без неё Prisma не подключается, приложение не работает.',
    requiredInProd: true,
    format: formats.nonEmpty,
    group: 'infra',
  },
  {
    name: 'DB_STATEMENT_TIMEOUT_MS',
    purpose:
      'Предел одного запроса к базе в миллисекундах (по умолчанию 30 000) — ' +
      'дольше запрос прерывается с ошибкой; 0 выключает предел. Рубильник ' +
      'без выкладки кода (src/prisma/statement-timeout.ts).',
    requiredInProd: false,
    format: (value: string): string | null =>
      isValidStatementTimeout(value)
        ? null
        : 'ожидалось целое число миллисекунд от 0 до 2147483647',
    group: 'infra',
  },
  {
    name: 'SUBSCRIPTION_ENABLED',
    purpose:
      '«true» включает автосписание подписки — выключено, пока автосписание не готово.',
    requiredInProd: false,
    format: formats.oneOf(['true', 'false']),
    group: 'infra',
  },
  {
    name: 'WEBAPP_URL',
    purpose:
      'Публичный адрес сайта (schemehappens.ru) — на нём строится колбэк ' +
      'OAuth и фронтенд-редиректы; без него вход через сайт не работает.',
    requiredInProd: true,
    format: formats.httpsUrl,
    group: 'infra',
  },
];
