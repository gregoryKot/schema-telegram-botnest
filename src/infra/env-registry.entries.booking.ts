// Записи реестра env-переменных (см. env-registry.ts) — группа booking:
// запись на консультацию, оплата, личный календарь, видеовстречи.
import { EnvVarSpec, formats } from './env-registry';

export const BOOKING_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'ADMIN_BOOKING_KEY',
    purpose:
      'Ключ админских эндпоинтов записи/статей/контента сайта — без него они ' +
      'отвечают 403 всем (assertAdminKey отказывает закрыто, не открыто).',
    requiredInProd: true,
    format: formats.nonEmpty,
    group: 'booking',
  },
  {
    name: 'APPLE_APP_PASSWORD',
    purpose:
      'Пароль приложения для CalDAV iCloud — вместе с APPLE_ID включает личный календарь.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'booking',
  },
  {
    name: 'APPLE_CALDAV_URL',
    purpose:
      'Явный адрес коллекции календаря iCloud — без него используется автообнаружение.',
    requiredInProd: false,
    format: formats.url,
    group: 'booking',
  },
  {
    name: 'APPLE_CALENDAR_NAME',
    purpose: 'Имя календаря iCloud для выбора среди нескольких — опционально.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'booking',
  },
  {
    name: 'APPLE_ID',
    purpose:
      'Apple ID (email) для CalDAV — без него личный календарь в слотах записи не учитывается.',
    requiredInProd: false,
    format: formats.email,
    group: 'booking',
  },
  {
    name: 'CALENDAR_BLOCK_SLOTS',
    purpose:
      '«true» — занятые в личном календаре часы скрываются из слотов записи.',
    requiredInProd: false,
    format: formats.oneOf(['true', 'false']),
    group: 'booking',
  },
  {
    name: 'MEETING_STATIC_URL',
    purpose:
      'Постоянная резервная комната встреч (Jitsi и т.п.), если Zoom не настроен.',
    requiredInProd: false,
    format: formats.url,
    group: 'booking',
  },
  {
    name: 'ROBOKASSA_FISCAL',
    purpose:
      '«false» — не отправлять фискальный чек в Робокассу (по умолчанию включён).',
    requiredInProd: false,
    format: formats.oneOf(['true', 'false']),
    group: 'booking',
  },
  {
    name: 'ROBOKASSA_IS_TEST',
    purpose: '«true» — тестовый режим Робокассы.',
    requiredInProd: false,
    format: formats.oneOf(['true', 'false']),
    group: 'booking',
  },
  {
    name: 'ROBOKASSA_MERCHANT_LOGIN',
    purpose:
      'Логин магазина в личном кабинете Робокассы — без него оплата недоступна.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'booking',
  },
  {
    name: 'ROBOKASSA_PASSWORD1',
    purpose: 'Пароль №1 Робокассы — подпись ссылки на оплату.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'booking',
  },
  {
    name: 'ROBOKASSA_PASSWORD2',
    purpose: 'Пароль №2 Робокассы — проверка подписи вебхука об оплате.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'booking',
  },
  {
    name: 'ZOOM_ACCOUNT_ID',
    purpose:
      'Server-to-Server OAuth аккаунт Zoom — вместе с CLIENT_ID/SECRET включает личные Zoom-ссылки.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'booking',
  },
  {
    name: 'ZOOM_CLIENT_ID',
    purpose: 'Client id Server-to-Server приложения Zoom.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'booking',
  },
  {
    name: 'ZOOM_CLIENT_SECRET',
    purpose: 'Client secret Server-to-Server приложения Zoom.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'booking',
  },
];
