// Записи реестра env-переменных (см. env-registry.ts) — группа auth:
// вход (MAX/Telegram; VK ID и Яндекс ID — env-registry.entries.oauth.ts), JWT,
// шифрование хранимых данных.
import { EnvVarSpec, formats } from './env-registry';
import { OAUTH_ENV_ENTRIES } from './env-registry.entries.oauth';

export const AUTH_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'ENCRYPTION_KEY',
    purpose:
      'Ключ AES-256-GCM (заметки, дневники) и HMAC ключа комнаты клиента ' +
      '(ClientMeeting.clientKey); без него прод не стартует (utils/crypto.ts).',
    requiredInProd: true,
    format: formats.hex32,
    group: 'auth',
  },
  {
    name: 'ENCRYPTION_KEY_OLD',
    purpose:
      'Старые ключи на время ротации (через запятую) — для расшифровки и ' +
      'поиска комнаты клиента; новое всегда пишется текущим ключом.',
    requiredInProd: false,
    format: formats.any,
    group: 'auth',
  },
  {
    name: 'JWT_SECRET',
    purpose:
      'Подписывает access/refresh/merge/2FA-challenge JWT и state входа сайта — ' +
      'без него вход через VK и merge аккаунтов не работает.',
    requiredInProd: true,
    format: formats.secret32,
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
  ...OAUTH_ENV_ENTRIES,
];
