// Записи реестра env (см. env-registry.ts), группа telegram: бот и мини-апп; канал — в entries.channel.ts.
import { EnvVarSpec, formats } from './env-registry';
import { checkTelegramUsername } from './env-registry.username';

export const TELEGRAM_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'ADMIN_ID',
    purpose:
      'Telegram id единственного администратора — без него не работают ни ' +
      'админские команды, ни алерты в Telegram (см. src/utils/admin-alert.ts).',
    requiredInProd: true,
    format: formats.telegramId,
    group: 'telegram',
  },
  {
    name: 'BOT_REDIRECT_USERNAME',
    purpose:
      'Имя второго бота, на который редиректит /start при миграции (опционально).',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'telegram',
  },
  {
    name: 'BOT_TOKEN',
    purpose:
      'Токен бота BotFather — без него бот не подключается к Telegram и ' +
      'алерты в Telegram не уходят.',
    requiredInProd: true,
    format: formats.botToken,
    group: 'telegram',
  },
  {
    name: 'BOT_USERNAME',
    purpose: 'Имя бота без @ для t.me-ссылок; без него приглашения отдают 503.',
    requiredInProd: true,
    format: checkTelegramUsername,
    group: 'telegram',
  },
  {
    name: 'MINIAPP_APP_NAME',
    purpose:
      'Slug мини-аппа в t.me/<bot>/<name> — дефолт «diary», если не задано.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'telegram',
  },
  {
    name: 'MINIAPP_URL',
    purpose:
      'Адрес webApp-кнопок и меню бота; по умолчанию кабинет APP_URL + /today ' +
      '(этап 5 единой версии), `APP_URL/app/` — откат на мини-апп.',
    requiredInProd: false,
    format: formats.httpsUrl,
    group: 'telegram',
  },
  {
    name: 'TELEGRAM_PROXY_URL',
    purpose:
      'Исходящий прокси до api.telegram.org на случай, если маршрут с хостинга ' +
      'не работает напрямую — без него бот ходит напрямую.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'telegram',
  },
];
