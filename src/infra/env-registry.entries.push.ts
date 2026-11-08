// Реестр env (env-registry.ts), группа infra: ключи уведомлений в приложении
// (веб-пуши, src/push/push-config.ts); → PLATFORM_ENV_ENTRIES. Обе части пары
// заданы или обе пусты: половину пары ловит проба самопроверки webPush.
import { EnvVarSpec, FormatValidator, formats } from './env-registry';

/** base64url без «=», декодируется ровно в `bytes` байт. */
const base64urlKey =
  (bytes: number): FormatValidator =>
  (value) => {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      return 'ожидался base64url (буквы, цифры, «-» и «_»)';
    }
    const got = Buffer.from(value, 'base64url').length;
    return got === bytes ? null : `ожидалось ${bytes} байт, получено ${got}`;
  };

const subject: FormatValidator = (value) =>
  value.startsWith('mailto:') ? null : formats.httpsUrl(value);

export const PUSH_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'VAPID_PUBLIC_KEY',
    purpose:
      'Публичный VAPID-ключ уведомлений в приложении (npx web-push ' +
      'generate-vapid-keys). Без пары ключей уведомления в приложении ' +
      'выключены; смена ключа обнуляет все подписки.',
    requiredInProd: false,
    format: base64urlKey(65),
    group: 'infra',
  },
  {
    name: 'VAPID_PRIVATE_KEY',
    purpose:
      'Приватный VAPID-ключ — пара к VAPID_PUBLIC_KEY, подписывает каждое ' +
      'уведомление в приложении. Секрет.',
    requiredInProd: false,
    format: base64urlKey(32),
    group: 'infra',
  },
  {
    name: 'VAPID_SUBJECT',
    purpose:
      'Контакт для push-сервисов (https-адрес или mailto:) — дефолт ' +
      'https://schemehappens.ru.',
    requiredInProd: false,
    format: subject,
    group: 'infra',
  },
];
