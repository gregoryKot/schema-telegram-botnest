// Записи реестра env-переменных (см. env-registry.ts) — группа email.
import { EnvVarSpec, formats } from './env-registry';

export const EMAIL_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'ADMIN_EMAIL',
    purpose:
      'Почта владельца для писем о записях и резервных алертов — без неё, при ' +
      'заданном RESEND_API_KEY, письма молчат (инцидент 2026-09-15).',
    requiredInProd: false,
    format: formats.email,
    group: 'email',
  },
  {
    name: 'EMAIL_FROM',
    purpose:
      'Адрес отправителя писем (magic-link, уведомления) — есть дефолт ' +
      '«Schema Happens <no-reply@schemehappens.ru>», если не задан.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'email',
  },
  {
    name: 'RESEND_API_KEY',
    purpose:
      'Ключ Resend — без него почта пользователям и владельцу не отправляется ' +
      '(magic-link, письма о записях, резервные алерты).',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'email',
  },
];
