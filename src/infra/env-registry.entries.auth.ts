// Записи реестра env-переменных (см. env-registry.ts) — группа auth:
// вход (Google/VK/MAX/Telegram OIDC), JWT, шифрование хранимых данных.
import { EnvVarSpec, formats } from './env-registry';

export const AUTH_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'ENCRYPTION_KEY',
    purpose:
      'Ключ AES-256-GCM для заметок/дневников/писем — без него в проде процесс ' +
      'не стартует (src/utils/crypto.ts бросает при старте).',
    requiredInProd: true,
    format: formats.hex32,
    group: 'auth',
  },
  {
    name: 'ENCRYPTION_KEY_OLD',
    purpose:
      'Старые ключи шифрования на время ротации (через запятую) — читаются ' +
      'только при расшифровке, новое всегда пишется текущим ключом.',
    requiredInProd: false,
    format: formats.any,
    group: 'auth',
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    purpose:
      'OAuth client id входа через Google — без него кнопка «Войти через Google» недоступна.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'auth',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    purpose:
      'OAuth client secret Google — без него обмен кода на токен падает.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'auth',
  },
  {
    name: 'GOOGLE_REDIRECT_URI',
    purpose:
      'Адрес возврата Google после входа — обязан вести на канонический хост ' +
      '(инцидент 2026-09-16: старый хост давал ERR_TOO_MANY_REDIRECTS).',
    requiredInProd: false,
    format: formats.httpsUrl,
    group: 'auth',
  },
  {
    name: 'JWT_SECRET',
    purpose:
      'Подписывает access/refresh/merge JWT сайта — без него вход через ' +
      'Google/VK и merge аккаунтов не работает.',
    requiredInProd: true,
    format: formats.nonEmpty,
    group: 'auth',
  },
  {
    name: 'MAX_BOT_TOKEN',
    purpose:
      'Перекрывает HEALTHY_ADULT_MAX_TOKEN для проверки подписи initData ' +
      'мини-аппа MAX, если бот мини-аппа когда-нибудь станет отдельным от канального.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'auth',
  },
  {
    name: 'SKIP_AUTH',
    purpose:
      'Dev-only обход проверки initData — хардкод-запрет в проде ' +
      '(src/api/init-data-paths.ts), в реестре только для формата/кросс-проверки.',
    requiredInProd: false,
    format: formats.oneOf(['true', 'false']),
    group: 'auth',
  },
  {
    name: 'VK_APP_ID',
    purpose:
      'OAuth client id входа через VK ID — без него кнопка «Войти через VK» недоступна.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'auth',
  },
  {
    name: 'VK_REDIRECT_URI',
    purpose:
      'Адрес возврата VK после входа — обязан вести на канонический хост.',
    requiredInProd: false,
    format: formats.httpsUrl,
    group: 'auth',
  },
];
