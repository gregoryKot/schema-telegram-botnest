// Записи реестра env-переменных (см. env-registry.ts) — группа telegram:
// сам бот и мини-апп (не канал «Здоровый Взрослый» — тот в entries.channel.ts).
import { EnvVarSpec, formats } from './env-registry';

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
    purpose:
      'Имя бота для ссылок t.me/<username> — дефолт SchemaLabBot, если не задано.',
    requiredInProd: false,
    format: formats.nonEmpty,
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
      'Базовый адрес для webApp-кнопок бота — дефолт vercel-адрес, если не задано.',
    requiredInProd: false,
    format: formats.url,
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
