// Записи реестра env-переменных (см. env-registry.ts) — ключи Yandex Cloud
// Postbox, через который уходит вся почта (postbox-mail.ts). Группа — email:
// записи подключаются в EMAIL_ENV_ENTRIES (env-registry.entries.email.ts).
import { EnvVarSpec } from './env-registry';
import { accessKey } from './env-registry.entries.backup';

export const POSTBOX_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'POSTBOX_ACCESS_KEY_ID',
    purpose:
      'Идентификатор статического ключа доступа сервисного аккаунта Yandex ' +
      'Cloud с ролью postbox.sender — пара к POSTBOX_SECRET_ACCESS_KEY; без ' +
      'пары почта пользователям и владельцу не отправляется (вход по ссылке, ' +
      'письма о записях, резервные алерты).',
    requiredInProd: false,
    format: accessKey,
    group: 'email',
  },
  {
    name: 'POSTBOX_SECRET_ACCESS_KEY',
    purpose:
      'Секретный ключ того же статического ключа доступа — вместе с ' +
      'POSTBOX_ACCESS_KEY_ID подписывает запросы на отправку писем в Yandex ' +
      'Cloud Postbox.',
    requiredInProd: false,
    format: accessKey,
    group: 'email',
  },
];
